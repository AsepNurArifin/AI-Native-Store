from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import utcnow
from app.models import Promotion


class PromotionNotFoundError(Exception):
    pass


class PromotionOverlapError(Exception):
    pass


class PromotionService:
    """FR-SMS-05 — lifecycle (on-read effective status) + no-overlap guard (BR 2)."""

    @staticmethod
    def effective_status(promo: Promotion, now: datetime | None = None) -> str:
        """BR 1 — effective status computed on-read; DB EXPIRED update is async."""
        now = now or utcnow()
        if promo.status == "REJECTED":
            return "REJECTED"
        if promo.status == "DRAFT":
            return "DRAFT"
        if now > promo.end_date:
            return "EXPIRED"
        if now >= promo.start_date and promo.status == "ACTIVE":
            return "ACTIVE"
        return promo.status

    @staticmethod
    async def list(db: AsyncSession, product_id: str | None = None) -> list[Promotion]:
        stmt = select(Promotion).order_by(Promotion.created_at.desc())
        if product_id:
            stmt = stmt.where(Promotion.product_id == product_id)
        rows = (await db.execute(stmt)).scalars().all()
        # on-read expiry refresh (BR 1 — best-effort before reading)
        changed = False
        for r in rows:
            if r.status == "ACTIVE" and utcnow() > r.end_date:
                r.status = "EXPIRED"
                changed = True
        if changed:
            await db.flush()
        return list(rows)

    @staticmethod
    async def check_overlap(
        db: AsyncSession, product_id: str, start: datetime, end: datetime, exclude_id: str | None = None
    ) -> bool:
        """BR 2 — any ACTIVE promotion for the same product with overlapping period."""
        stmt = select(Promotion).where(
            Promotion.product_id == product_id,
            Promotion.status == "ACTIVE",
            Promotion.start_date < end,
            Promotion.end_date > start,
        )
        if exclude_id:
            stmt = stmt.where(Promotion.id != exclude_id)
        return (await db.execute(stmt)).scalar_one_or_none() is not None

    @staticmethod
    async def create(
        db: AsyncSession,
        *,
        product_id: str,
        discount_percentage: float,
        start_date: datetime,
        end_date: datetime,
        status: str = "DRAFT",
    ) -> Promotion:
        if end_date <= start_date:
            raise ValueError("end_date must be after start_date")
        if not (0 < discount_percentage <= settings.max_discount_percent):
            raise ValueError(
                f"discount must be > 0 and <= {settings.max_discount_percent}%"
            )
        if status == "ACTIVE":
            if await PromotionService.check_overlap(db, product_id, start_date, end_date):
                raise PromotionOverlapError()
        promo = Promotion(
            product_id=product_id,
            discount_percentage=discount_percentage,
            start_date=start_date,
            end_date=end_date,
            status=status,
        )
        db.add(promo)
        await db.flush()
        return promo

    @staticmethod
    async def activate(db: AsyncSession, promo: Promotion) -> Promotion:
        """Validate 4 conditions (FR-AA-05) then activate."""
        errors = []
        if promo.status == "DRAFT":
            # condition 1: product exists & ACTIVE
            from app.models import Product

            product = await db.get(Product, promo.product_id)
            if not product:
                errors.append("PRODUCT_NOT_FOUND")
            elif product.status != "ACTIVE":
                errors.append("PRODUCT_INACTIVE")
            # condition 2
            if promo.end_date <= promo.start_date:
                errors.append("INVALID_DATE_RANGE")
            # condition 3
            if not (0 < promo.discount_percentage <= settings.max_discount_percent):
                errors.append("DISCOUNT_OUT_OF_RANGE")
            # condition 4
            if not errors and await PromotionService.check_overlap(
                db, str(promo.product_id), promo.start_date, promo.end_date, exclude_id=str(promo.id)
            ):
                errors.append("PROMOTION_OVERLAP")
            if errors:
                raise ValueError("|".join(errors))
            promo.status = "ACTIVE"
            await db.flush()
        return promo
