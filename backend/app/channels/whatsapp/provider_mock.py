"""Mock WhatsApp provider — dev/test tanpa WABA (WA_PROVIDER=mock).

- parse_webhook: membaca pesan dari payload JSON buatan (simulasi Meta)
- send_message: menulis log + endpoint dev /api/v1/dev/mock-wa (lihat routes/dev)
- hanya menerima nomor dari settings.wa_test_number_list
"""

import logging

from app.channels.base import InboundMessage
from app.channels.whatsapp.provider_base import WhatsAppProviderBase
from app.core.config import settings

logger = logging.getLogger(__name__)


class MockWhatsAppProvider(WhatsAppProviderBase):
    def parse_webhook(self, payload: dict) -> InboundMessage | None:
        """Payload tiruan: {"from": "628123...", "text": "...", "message_id": "..."}"""
        sender = payload.get("from")
        text = payload.get("text")
        if not sender or not text:
            return None
        if settings.wa_test_number_list and sender not in settings.wa_test_number_list:
            logger.info("nomor %s bukan test number — skip", sender)
            return None
        return InboundMessage(
            channel="WHATSAPP",
            sender_id=sender,
            content=text,
            message_id=payload.get("message_id") or f"mock-{sender}-{len(text)}",
            raw=payload,
        )

    async def send_message(self, *, recipient_id: str, content: str, interactive: dict | None = None) -> bool:
        logger.info("[mock-wa] -> %s: %s | interactive=%s", recipient_id, content[:120], bool(interactive))
        return True
