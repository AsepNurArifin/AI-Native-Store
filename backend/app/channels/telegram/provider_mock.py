"""Mock Telegram provider — dev/test tanpa bot nyata (TELEGRAM_PROVIDER=mock).

Menerima DUA bentuk payload:
1. Bentuk sederhana untuk dev route /api/v1/dev/mock-tg:
     {"from": "123456", "text": "halo", "message_id": "m-1", "name": "Andi"}
2. Bentuk Update Telegram asli (dipakai test supaya parsing realistis):
     {"update_id": 1, "message": {"chat": {"id": 123}, "text": "halo", ...}}
     {"update_id": 2, "callback_query": {"data": "CONFIRM:abc", ...}}
"""

import logging

from app.channels.base import InboundMessage
from app.channels.telegram.provider_base import TelegramProviderBase

logger = logging.getLogger(__name__)


def parse_telegram_update(payload: dict) -> InboundMessage | None:
    """Parsing Update Telegram asli — dibagi dengan provider_bot (satu logika).

    Bentuk Update yang didukung:
    - message.text                          -> pesan biasa
    - callback_query.data (tombol inline)  -> CONFIRM:<ref> / CANCEL / lainnya
    Selain itu (edited_message, photo, channel_post, dll) -> None.
    """
    update_id = payload.get("update_id")

    # 1) callback_query — tombol inline (konfirmasi/batal pesanan)
    cq = payload.get("callback_query")
    if isinstance(cq, dict):
        data = cq.get("data")
        chat = (cq.get("message") or {}).get("chat") or {}
        chat_id = chat.get("id")
        if data is None or chat_id is None:
            return None
        return InboundMessage(
            channel="TELEGRAM",
            sender_id=str(chat_id),
            content=str(data),
            message_id=str(update_id) if update_id is not None else None,
            raw=payload,
        )

    # 2) message teks biasa
    msg = payload.get("message")
    if not isinstance(msg, dict):
        return None
    text = msg.get("text")
    chat_id = (msg.get("chat") or {}).get("id")
    if not text or chat_id is None:
        return None  # non-teks (photo/sticker) atau tanpa chat — diabaikan MVP

    return InboundMessage(
        channel="TELEGRAM",
        sender_id=str(chat_id),
        content=str(text),
        message_id=str(update_id) if update_id is not None else None,
        raw=payload,
    )


class MockTelegramProvider(TelegramProviderBase):
    def parse_webhook(self, payload: dict) -> InboundMessage | None:
        # bentuk sederhana dev route
        if "from" in payload and "text" in payload:
            return InboundMessage(
                channel="TELEGRAM",
                sender_id=str(payload["from"]),
                content=str(payload["text"]),
                message_id=payload.get("message_id") or f"mock-tg-{payload['from']}-{len(payload['text'])}",
                raw=payload,
            )
        # bentuk Update Telegram asli
        return parse_telegram_update(payload)

    async def send_message(self, *, recipient_id: str, content: str, interactive: dict | None = None) -> bool:
        logger.info("[mock-tg] -> %s: %s | buttons=%s", recipient_id, content[:120], bool(interactive))
        return True
