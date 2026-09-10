"""WhatsApp adapter — normalisasi webhook Meta -> InboundMessage -> SalesAgent -> kirim balasan.

Provider disuntik dari env WA_PROVIDER (mock | meta):
- mock: dev/test tanpa API nyata (5 kontak uji via wa_test_numbers)
- meta : Meta Cloud API (WABA resmi, F7)
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.channels.base import InboundMessage
from app.channels.whatsapp.provider_mock import MockWhatsAppProvider
from app.channels.whatsapp.provider_meta import MetaCloudWhatsAppProvider
from app.core.config import settings
from app.ai.sales_agent import SalesAgent
from app.schemas.chat import ChatReply

logger = logging.getLogger(__name__)


class WhatsAppAdapter:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.provider = self._build_provider()

    def _build_provider(self):
        provider = (settings.wa_provider or "mock").lower()
        if provider == "meta":
            return MetaCloudWhatsAppProvider()
        return MockWhatsAppProvider()

    async def handle_webhook(self, payload: dict) -> ChatReply | None:
        """Meta webhook payload -> InboundMessage -> SalesAgent -> reply via provider."""
        msg = self.provider.parse_webhook(payload)
        if msg is None:
            return None  # bukan message type (status, delivery dll)

        # idempotensi per message_id dari Meta (dedupe webhook retry)
        if msg.message_id and not self._is_new_message(msg.message_id):
            logger.info("duplicate message %s — skip", msg.message_id)
            return None

        reply = await self._route_to_agent(msg)
        await self.provider.send_message(
            recipient_id=msg.sender_id,
            content=reply.reply,
            interactive=self._build_confirm_buttons(reply),
        )
        return reply

    def _is_new_message(self, message_id: str) -> bool:
        # MVP: in-memory dedupe set (per-process). F7: tabel webhook_events.
        from app.channels.whatsapp.adapter import _seen

        if message_id in _seen:
            return False
        _seen.add(message_id)
        return True

    async def _route_to_agent(self, msg: InboundMessage) -> ChatReply:
        # cari/create conversation untuk nomor WA ini
        from app.services.conversation_service import ConversationService

        customer = await ConversationService.ensure_customer(
            self.db,
            channel="WHATSAPP",
            identifier=msg.sender_id,
            name=msg.sender_id,
            contact=msg.sender_id,
        )
        conv = await ConversationService.create(self.db, customer, "WHATSAPP")
        agent = SalesAgent(self.db)
        reply = await agent.handle_message(
            conversation_id=str(conv.id),
            sender="CUSTOMER",
            content=msg.content,
            channel="WHATSAPP",
        )
        await self.db.commit()
        return reply

    def _build_confirm_buttons(self, reply: ChatReply) -> dict | None:
        """Interactive reply buttons utk konfirmasi order (UC-02 E5) — hanya jika ada summary."""
        if not reply.order_summary:
            return None
        return {
            "type": "button",
            "body": {"text": f"Konfirmasi pesanan? Total: Rp{reply.order_summary.total:,.0f}"},
            "action": {
                "buttons": [
                    {"type": "reply", "reply": {"id": f"CONFIRM:{reply.order_summary.summary_ref}", "title": "✅ Konfirmasi"}},
                    {"type": "reply", "reply": {"id": "CANCEL", "title": "❌ Batalkan"}},
                ]
            },
        }


_seen: set[str] = set()
