from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_owner
from app.db.session import get_session
from app.models import AIAction, User
from app.schemas.ai import AIActionOut, ApproveResponse, RejectRequest
from app.services.ai_action_service import ActionError, ActionNotOwnerError, AIActionService

router = APIRouter(prefix="/ai-actions", tags=["ai-actions"], dependencies=[Depends(require_owner)])


@router.get("", response_model=list[AIActionOut])
async def list_actions(
    status_: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_owner),
):
    rows, _ = await AIActionService.list(db, status=status_, page=page, page_size=page_size)
    return list(rows)


@router.get("/{action_id}", response_model=AIActionOut)
async def get_action(action_id: str, db: AsyncSession = Depends(get_session), _: User = Depends(require_owner)):
    action = await AIActionService.get(db, action_id)
    if not action:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="AI action tidak ditemukan")
    return action


@router.post("/{action_id}/approve", response_model=ApproveResponse)
async def approve_action(action_id: str, db: AsyncSession = Depends(get_session), user: User = Depends(require_owner)):
    action = await AIActionService.get(db, action_id)
    if not action:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="AI action tidak ditemukan")
    try:
        action = await AIActionService.approve(db, action, str(user.id))
        await db.commit()
    except ActionNotOwnerError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Hanya Owner yang dapat approve")
    except ActionError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, detail={"code": e.code, "message": e.message})
    await db.refresh(action)
    return ApproveResponse(
        ai_action_id=str(action.id),
        status=action.status,
        result_target_id=str(action.result_target_id) if action.result_target_id else None,
        validation_failures=action.validation_failures,
    )


@router.post("/{action_id}/reject", response_model=AIActionOut)
async def reject_action(action_id: str, body: RejectRequest | None = None, db: AsyncSession = Depends(get_session), user: User = Depends(require_owner)):
    action = await AIActionService.get(db, action_id)
    if not action:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="AI action tidak ditemukan")
    try:
        action = await AIActionService.reject(db, action, str(user.id), note=body.note if body else None)
        await db.commit()
    except ActionNotOwnerError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Hanya Owner yang dapat reject")
    except ActionError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, detail={"code": e.code, "message": e.message})
    await db.refresh(action)
    return action
