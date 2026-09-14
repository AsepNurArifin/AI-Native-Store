"""Dev-only routes — TELEGRAM_PROVIDER=mock. Jangan diaktifkan di produksi (guard settings.debug)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.channels.telegram.adapter import TelegramAdapter
from app.core.config import settings
from app.db.session import get_session
from app.schemas.chat import ChatReply

router = APIRouter(prefix="/dev", tags=["dev"])


@router.post("/mock-tg", response_model=ChatReply | dict)
async def mock_tg_send(payload: dict, db: AsyncSession = Depends(get_session)):
    """Simulasi pesan Telegram masuk — payload {"from": "12345", "text": "halo"}
    atau bentuk Update Telegram asli (message/callback_query)."""
    if not settings.debug:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mock Telegram hanya aktif di mode dev")
    adapter = TelegramAdapter(db)
    reply = await adapter.handle_webhook(payload)
    if reply is None:
        return {"status": "ignored", "reason": "bukan message type (non-teks / edited dsb.)"}
    return reply
