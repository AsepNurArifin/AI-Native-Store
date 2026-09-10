from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import utcnow
from app.models import AIAction, Approval, Promotion, User, UserRole
from app.services.audit_service import AuditService
from app.services.promotion_service import PromotionService


class ActionError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class ActionNotOwnerError(Exception):
    pass


class AIActionService:
    """Jalur 2 (SRS §2.3) — AI administrative action lifecycle:
    DRAFT -> (Owner approve) -> APPROVED -> validate (FR-AA-05) -> EXECUTED
                                      -> APPROVED_VALIDATION_FAILED
    DRAFT -> (Owner reject) -> REJECTED
    """

    @staticmethod
    async def create_draft(
        db: AsyncSession,
        *,
        requested_by: str,
        action_type: str,
        payload: dict,
    ) -> AIAction:
        action = AIAction(
            action_type=action_type,
            payload=payload,
            status="DRAFT",
            requested_by=requested_by,
        )
        db.add(action)
        await db.flush()
        await AuditService.log(
            db,
            event="CREATED",
            actor_type="AI_SYSTEM",
            ai_action_id=str(action.id),
            detail={"action_type": action_type, "payload": payload, "requested_by": requested_by},
        )
        return action

    @staticmethod
    async def get(db: AsyncSession, action_id: str) -> AIAction | None:
        return await db.get(AIAction, action_id)

    @staticmethod
    async def list(db: AsyncSession, *, status: str | None = None, page: int = 1, page_size: int = 20) -> tuple[list[AIAction], int]:
        stmt = select(AIAction).order_by(AIAction.created_at.desc())
        if status:
            stmt = stmt.where(AIAction.status == status)
        total = len((await db.execute(stmt)).scalars().all())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await db.execute(stmt)).scalars().all()
        return list(rows), total

    @staticmethod
    async def _validate_actor_is_owner(db: AsyncSession, actor_id: str) -> User:
        actor = await db.get(User, actor_id)
        if not actor or actor.role != UserRole.OWNER.value:
            raise ActionNotOwnerError()
        return actor

    @staticmethod
    async def approve(db: AsyncSession, action: AIAction, actor_id: str, note: str | None = None) -> AIAction:
        """Owner-only (FR-AA-03). Approve then validate (FR-AA-05); execute if valid."""
        owner = await AIActionService._validate_actor_is_owner(db, actor_id)
        if action.status != "DRAFT":
            raise ActionError("INVALID_STATE", f"Draft berstatus {action.status} tidak bisa di-approve.")
        action.status = "APPROVED"
        action.decided_at = utcnow()
        db.add(Approval(ai_action_id=str(action.id), actor_id=str(owner.id), decision="APPROVED", note=note))
        await db.flush()
        await AuditService.log(
            db, event="APPROVED", actor_type="USER", actor_id=str(owner.id),
            ai_action_id=str(action.id), detail={"note": note},
        )
        return await AIActionService._validate_and_execute(db, action)

    @staticmethod
    async def reject(db: AsyncSession, action: AIAction, actor_id: str, note: str | None = None) -> AIAction:
        owner = await AIActionService._validate_actor_is_owner(db, actor_id)
        if action.status != "DRAFT":
            raise ActionError("INVALID_STATE", f"Draft berstatus {action.status} tidak bisa di-reject.")
        action.status = "REJECTED"
        action.decided_at = utcnow()
        db.add(Approval(ai_action_id=str(action.id), actor_id=str(owner.id), decision="REJECTED", note=note))
        await db.flush()
        await AuditService.log(
            db, event="REJECTED", actor_type="USER", actor_id=str(owner.id),
            ai_action_id=str(action.id), detail={"note": note},
        )
        return action

    @staticmethod
    async def _validate_and_execute(db: AsyncSession, action: AIAction) -> AIAction:
        """FR-AA-05 — 4 conditions; on failure -> APPROVED_VALIDATION_FAILED (not executed)."""
        if action.action_type == "CREATE_PROMOTION":
            return await AIActionService._execute_create_promotion(db, action)
        errors = {"UNSUPPORTED_ACTION": f"Action {action.action_type} belum didukung."}
        action.status = "APPROVED_VALIDATION_FAILED"
        action.validation_failures = errors
        await db.flush()
        await AuditService.log(
            db, event="VALIDATION_FAILED", actor_type="AI_SYSTEM",
            ai_action_id=str(action.id), detail=errors,
        )
        return action

    @staticmethod
    async def _execute_create_promotion(db: AsyncSession, action: AIAction) -> AIAction:
        from app.models import Product

        payload = action.payload
        product_id = payload.get("product_id")
        errors: dict = {}

        # 1. product exists & ACTIVE
        product = await db.get(Product, product_id) if product_id else None
        if not product:
            errors["PRODUCT_NOT_FOUND"] = "Produk tidak ditemukan."
        elif product.status != "ACTIVE":
            errors["PRODUCT_INACTIVE"] = "Produk tidak aktif."
        # 2. date range
        try:
            start = datetime.fromisoformat(payload["start_date"].replace("Z", "+00:00"))
            end = datetime.fromisoformat(payload["end_date"].replace("Z", "+00:00"))
        except (KeyError, ValueError):
            start, end = None, None
            errors["INVALID_DATE"] = "Periode promosi tidak valid."
        else:
            if end <= start:
                errors["INVALID_DATE_RANGE"] = "end_date harus setelah start_date."
        # 3. discount range
        disc = payload.get("discount_percentage")
        if disc is None or not (0 < disc <= settings.max_discount_percent):
            errors["DISCOUNT_OUT_OF_RANGE"] = f"Diskon harus 0% < x <= {settings.max_discount_percent}%."
        # 4. no overlap (only if earlier checks pass)
        if not errors and start and end:
            if await PromotionService.check_overlap(db, product_id, start, end):
                errors["PROMOTION_OVERLAP"] = "Promosi aktif lain untuk produk yang sama bertumpang tindih."

        if errors:
            action.status = "APPROVED_VALIDATION_FAILED"
            action.validation_failures = errors
            await db.flush()
            await AuditService.log(
                db, event="VALIDATION_FAILED", actor_type="AI_SYSTEM",
                ai_action_id=str(action.id), detail=errors,
            )
            return action

        promo = await PromotionService.create(
            db,
            product_id=product_id,
            discount_percentage=disc,
            start_date=start,
            end_date=end,
            status="ACTIVE",
        )
        action.status = "EXECUTED"
        action.executed_at = utcnow()
        action.result_target_id = str(promo.id)
        await db.flush()
        await AuditService.log(
            db, event="EXECUTED", actor_type="AI_SYSTEM",
            ai_action_id=str(action.id),
            detail={"promotion_id": str(promo.id), "payload": payload},
        )
        return action
