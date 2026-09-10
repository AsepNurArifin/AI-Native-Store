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
        if message_id in _seen:
            return False
        _seen.add(message_id)
        return True

    async def _route_to_agent(self, msg: InboundMessage) -> ChatReply:
        """Alur pesan masuk channel WA (FR-SA-05, UC-02 E5):
        - konfirmasi eksplisit (CONFIRM:<ref>) -> langsung buat order (bukan teks bebas)
        - CANCEL -> tutup sesi tanpa order
        - selain itu -> SalesAgent
        """
        from app.services.conversation_service import ConversationService

        customer = await ConversationService.ensure_customer(
            self.db,
            channel="WHATSAPP",
            identifier=msg.sender_id,
            name=msg.sender_id,
            contact=msg.sender_id,
        )

        # reuse percakapan OPEN yang masih aktif — jangan buat baru per pesan
        # (Fix 1.4 / FR-SMS-07: konteks sesi harus tersambung lintas pesan).
        conv = await ConversationService.find_open(self.db, customer, "WHATSAPP")
        if conv is None:
            conv = await ConversationService.create(self.db, customer, "WHATSAPP")
        conversation_id = str(conv.id)

        # 1) Konfirmasi eksplisit via tombol interactive reply (UC-02 E5)
        if msg.content.startswith("CONFIRM:"):
            reply = await self._confirm_order(customer, conversation_id, msg.content)
            await self.db.commit()
            return reply

        # 2) Pembatalan eksplisit
        if msg.content.strip().upper() == "CANCEL":
            await ConversationService.add_message(
                self.db, conversation_id, sender="CUSTOMER", content=msg.content,
                message_type="BUTTON_REPLY", raw_payload={"reply_id": msg.content},
            )
            await ConversationService.set_outcome(self.db, conversation_id, "ABANDONED")
            await self.db.commit()
            return ChatReply(reply="Baik, pesanan dibatalkan. Ada lagi yang bisa saya bantu? 🙏")

        # 3) Pesan biasa -> SalesAgent
        agent = SalesAgent(self.db)
        try:
            reply = await agent.handle_message(
                conversation_id=conversation_id,
                sender="CUSTOMER",
                content=msg.content,
                channel="WHATSAPP",
            )
        except Exception:
            # R4 — tandai sesi ERROR supaya tidak menggantung
            await ConversationService.set_outcome(self.db, conversation_id, "ERROR")
            await self.db.commit()
            raise
        await self.db.commit()
        return reply

    async def _confirm_order(self, customer, conversation_id: str, content: str) -> ChatReply:
        """CONFIRM:<ref> -> OrderService.create_from_summary (FR-SA-05, UC-02 E5/E7)."""
        from app.services.conversation_service import ConversationService
        from app.services.order_service import OrderError, OrderService
        from app.services.summary_store import get as get_summary

        ref = content.split(":", 1)[1].strip()
        summary = get_summary(ref)
        if summary is None:
            # E7: summary kedaluwarsa / tidak dikenal — minta ulang tanpa 500
            return ChatReply(
                reply="Ringkasan pesanan sudah kedaluwarsa. Silakan ulangi pesanan Anda, nanti saya buatkan ringkasan baru. 🙏"
            )

        try:
            order, replayed = await OrderService.create_from_summary(
                self.db,
                conversation_id=conversation_id,
                channel="WHATSAPP",
                customer_identity={
                    "channel": "WHATSAPP",
                    "identifier": customer.identifier,
                    "name": customer.name,
                    "contact": customer.contact,
                },
                items=[{"product_id": i.product_id, "quantity": i.quantity} for i in summary.items],
                idempotency_key=f"wa:{ref}",  # stabil per ref → retry webhook tidak dobel order
            )
        except OrderError as e:
            return ChatReply(reply=f"Mohon maaf, pesanan tidak bisa diproses: {e.message}")

        await ConversationService.add_message(
            self.db, conversation_id, sender="CUSTOMER",
            content=content, message_type="BUTTON_REPLY",
            raw_payload={"reply_id": content},
        )
        await ConversationService.set_outcome(self.db, conversation_id, "ORDERED")

        total = float(order.total_amount)
        status_txt = "(sudah diproses sebelumnya)" if replayed else "berhasil dicatat ✅"
        return ChatReply(
            reply=f"Pesanan #{str(order.id)[:8]} {status_txt}. Total: Rp{total:,.0f}. "
            "Terima kasih sudah berbelanja! 🙏"
        )

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
