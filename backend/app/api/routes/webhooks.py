from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session
from app.schemas.chat import ChatReply
from app.services.conversation_service import ConversationService
from app.channels.whatsapp.adapter import WhatsAppAdapter

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.get("/whatsapp")
async def whatsapp_verify(request: Request):
    """Meta webhook verification (F3 — mock provider skips this)."""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    if mode == "subscribe" and token == settings.wa_webhook_verify_token:
        return int(challenge or 0)
    raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Verification token mismatch")


@router.post("/whatsapp")
async def whatsapp_webhook(request: Request, db: AsyncSession = Depends(get_session)):
    """Meta Cloud API webhook -> normalized InboundMessage -> SalesAgent.
    Signature verification happens inside provider (F7); mock provider accepts all.
    """
    adapter = WhatsAppAdapter(db)
    response = await adapter.handle_webhook(await request.json())
    return {"status": "ok", "reply": response.reply if isinstance(response, ChatReply) else None}
