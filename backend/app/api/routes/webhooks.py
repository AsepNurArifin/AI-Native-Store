import json

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import rate_limit
from app.db.session import get_session
from app.schemas.chat import ChatReply
from app.channels.telegram.adapter import TelegramAdapter

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post(
    "/telegram",
    # P5: webhook publik — 60/menit/IP (longgar: webhook Telegram datang dari
    # server Telegram yang sah + retry; limit hanya penangkal flood.
    dependencies=[Depends(rate_limit(max_requests=60, window_seconds=60))],
)
async def telegram_webhook(request: Request, db: AsyncSession = Depends(get_session)):
    """Webhook Update Telegram -> InboundMessage -> SalesAgent -> balas via Bot API.

    P5/F3: diverifikasi header `X-Telegram-Bot-Api-Secret-Token` (secret_token
    yang diset saat setWebhook). Provider mock tidak memverifikasi (dev/test).
    Telegram mengharapkan respons cepat (200) — pemrosesan AI tetap sinkron
    di MVP ini (cukup untuk skala demo).
    """
    adapter = TelegramAdapter(db)

    if not adapter.verify_request(request.headers.get("X-Telegram-Bot-Api-Secret-Token")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook secret")

    raw_body = await request.body()
    # P5: body bukan JSON valid (retry rusak / probe) -> 400, bukan 500.
    try:
        payload = json.loads(raw_body) if raw_body else {}
    except json.JSONDecodeError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Body webhook bukan JSON valid")
    response = await adapter.handle_webhook(payload)
    return {"status": "ok", "reply": response.reply if isinstance(response, ChatReply) else None}
