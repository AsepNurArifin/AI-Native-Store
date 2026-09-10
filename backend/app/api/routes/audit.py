from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_owner
from app.db.session import get_session
from app.models import User
from app.schemas.ai import AuditLogOut
from app.services.audit_service import AuditService

router = APIRouter(prefix="/audit", tags=["audit"], dependencies=[Depends(require_owner)])


@router.get("/logs", response_model=list[AuditLogOut])
async def list_audit_logs(
    ai_action_id: str | None = None,
    event: str | None = None,
    actor_type: str | None = Query(default=None, pattern="^(USER|AI_SYSTEM)$"),
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_owner),
):
    rows, _ = await AuditService.list(db, ai_action_id=ai_action_id, event=event, actor_type=actor_type, page=page, page_size=page_size)
    return list(rows)
