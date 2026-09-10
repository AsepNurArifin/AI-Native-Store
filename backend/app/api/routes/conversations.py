from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_staff_or_owner
from app.db.session import get_session
from app.models import User
from app.schemas.customer import ConversationDetail, ConversationOut
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations", tags=["conversations"], dependencies=[Depends(require_staff_or_owner)])


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    channel: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_staff_or_owner),
):
    rows, _ = await ConversationService.list_conversations(db, channel=channel, page=page, page_size=page_size)
    return list(rows)


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(conversation_id: str, db: AsyncSession = Depends(get_session), _: User = Depends(require_staff_or_owner)):
    result = await ConversationService.detail(db, conversation_id)
    if not result:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Percakapan tidak ditemukan")
    conv, messages, recs = result
    data = ConversationDetail.model_validate(conv)
    data.messages = messages
    data.recommendations = recs
    return data
