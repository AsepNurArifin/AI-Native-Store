"""Dev-only routes — WA_PROVIDER=mock. Jangan diaktifkan di produksi (guard settings.debug)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.channels.whatsapp.adapter import WhatsAppAdapter
from app.core.config import settings
from app.db.session import get_session
from app.schemas.chat import ChatReply

router = APIRouter(prefix="/dev", tags=["dev"])


@router.post("/mock-wa", response_model=ChatReply | dict)
async def mock_wa_send(payload: dict, db: AsyncSession = Depends(get_session)):
    """Simulasi pesan WhatsApp masuk — payload {"from": "62812...", "text": "halo"}."""
    if not settings.debug:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mock WA hanya aktif di mode dev")
    adapter = WhatsAppAdapter(db)
    reply = await adapter.handle_webhook(payload)
    if reply is None:
        return {"status": "ignored", "reason": "bukan message type / nomor bukan test number"}
    return reply
