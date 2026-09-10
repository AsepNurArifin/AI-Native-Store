from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


class AuditService:
    """FR-AA-04 — the single write path for AuditLog (append-only)."""

    @staticmethod
    async def log(
        db: AsyncSession,
        *,
        event: str,
        actor_type: str,
        actor_id: str | None = None,
        ai_action_id: str | None = None,
        detail: dict | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            ai_action_id=ai_action_id,
            event=event,
            actor_type=actor_type,
            actor_id=actor_id if actor_type == "USER" else None,
            detail=detail or {},
        )
        db.add(entry)
        await db.flush()
        return entry

    @staticmethod
    async def list(
        db: AsyncSession,
        *,
        ai_action_id: str | None = None,
        event: str | None = None,
        actor_type: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AuditLog], int]:
        stmt = select(AuditLog)
        if ai_action_id:
            stmt = stmt.where(AuditLog.ai_action_id == ai_action_id)
        if event:
            stmt = stmt.where(AuditLog.event == event)
        if actor_type:
            stmt = stmt.where(AuditLog.actor_type == actor_type)
        total = len((await db.execute(stmt)).scalars().all())
        stmt = stmt.order_by(AuditLog.timestamp.desc()).offset((page - 1) * page_size).limit(page_size)
        rows = (await db.execute(stmt)).scalars().all()
        return list(rows), total
