"""Routing logic bersama untuk channel messaging — BR-09 + Fase 3 PLAN_PRODUCT_LAUNCH.

TelegramAdapter (dan channel messaging baru nanti) memiliki alur identik:

    parse webhook (provider) -> InboundMessage -> dedupe message_id
      -> shortcut CONFIRM:<ref> / CANCEL (UC-02 E5)
      -> selain itu SalesAgent (channel-agnostic)
      -> balas via provider + tombol konfirmasi channel-native

Perbedaan antar channel hanyalah hook: nama channel, prefix idempotensi,
format tombol konfirmasi (_build_confirm_buttons), verifikasi webhook
(verify_request — signature HMAC vs secret token), dan ekstraksi nama
customer (_customer_name). Semua diOverride subclass.
"""

import logging
from abc import ABC, abstractmethod

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.sales_agent import SalesAgent
from app.channels.base import InboundMessage
from app.schemas.chat import ChatReply

logger = logging.getLogger(__name__)


class MessagingChannelAdapter(ABC):
    """Base adapter channel messaging (Telegram / channel baru nanti)."""

    CHANNEL: str = ""            # "TELEGRAM" | ...
    CONFIRM_KEY_PREFIX: str = ""  # prefix idempotency key order ("tg" / ...)

    def __init__(self, db: AsyncSession, provider) -> None:
        self.db = db
        self.provider = provider

    # ------------------------------------------------------------ hooks

    def _customer_name(self, msg: InboundMessage) -> str:
        """Nama customer dari payload channel — default: sender_id."""
        return msg.sender_id

    @abstractmethod
    def _build_confirm_buttons(self, reply: ChatReply) -> dict | None:
        """Tombol konfirmasi order (UC-02 E5) dalam format channel-native."""
        ...

    # ------------------------------------------------------- alur inti

    async def handle_webhook(self, payload: dict) -> ChatReply | None:
        """Webhook -> InboundMessage -> SalesAgent -> balas via provider."""
        msg = self.provider.parse_webhook(payload)
        if msg is None:
            return None  # bukan message type (status, delivery, edited dll)

        # idempotensi per message_id dari channel (dedupe webhook retry)
        if msg.message_id and not self._is_new_message(msg.message_id):
            logger.info("[%s] duplicate message %s — skip", self.CHANNEL, msg.message_id)
            return None

        reply = await self._route_to_agent(msg)
        await self.provider.send_message(
            recipient_id=msg.sender_id,
            content=reply.reply,
            interactive=self._build_confirm_buttons(reply),
        )
        return reply

    def _is_new_message(self, message_id: str) -> bool:
        # MVP: in-memory dedupe set (per-process), di-key per channel.
        # F7: tabel webhook_events untuk persisten lintas restart.
        key = f"{self.CHANNEL}:{message_id}"
        if key in _seen:
            return False
        _seen.add(key)
        return True

    async def _route_to_agent(self, msg: InboundMessage) -> ChatReply:
        """Alur pesan masuk channel (FR-SA-05, UC-02 E5):
        - konfirmasi eksplisit (CONFIRM:<ref>) -> langsung buat order (bukan teks bebas)
        - CANCEL -> tutup sesi tanpa order
        - selain itu -> SalesAgent
        """
        from app.services.conversation_service import ConversationService

        customer = await ConversationService.ensure_customer(
            self.db,
            channel=self.CHANNEL,
            identifier=msg.sender_id,
            name=self._customer_name(msg),
            contact=msg.sender_id,
        )

        # reuse percakapan OPEN yang masih aktif — jangan buat baru per pesan
        # (Fix 1.4 / FR-SMS-07: konteks sesi harus tersambung lintas pesan).
        conv = await ConversationService.find_open(self.db, customer, self.CHANNEL)
        if conv is None:
            conv = await ConversationService.create(self.db, customer, self.CHANNEL)
        conversation_id = str(conv.id)

        # 1) Konfirmasi eksplisit via tombol reply (UC-02 E5)
        if msg.content.startswith("CONFIRM:"):
            reply = await self._confirm_order(customer, conversation_id, msg.content)
            await self.db.commit()
            return reply

        # 2) Pembatalan eksplisit
        if msg.content.strip().upper() == "CANCEL":
            from app.services.summary_store import pop_for_conversation

            await ConversationService.add_message(
                self.db, conversation_id, sender="CUSTOMER", content=msg.content,
                message_type="BUTTON_REPLY", raw_payload={"reply_id": msg.content},
            )
            await ConversationService.set_outcome(self.db, conversation_id, "ABANDONED")
            pop_for_conversation(conversation_id)  # summary dikonsumsi — jangan render ulang tombol
            await self.db.commit()
            return ChatReply(reply="Baik, pesanan dibatalkan. Ada lagi yang bisa saya bantu? 🙏")

        # 3) Pesan biasa -> SalesAgent
        agent = SalesAgent(self.db)
        try:
            reply = await agent.handle_message(
                conversation_id=conversation_id,
                sender="CUSTOMER",
                content=msg.content,
                channel=self.CHANNEL,
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
        from app.services.summary_store import pop_for_conversation

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
                channel=self.CHANNEL,
                customer_identity={
                    "channel": self.CHANNEL,
                    "identifier": customer.identifier,
                    "name": customer.name,
                    "contact": customer.contact,
                },
                items=[{"product_id": i.product_id, "quantity": i.quantity} for i in summary.items],
                idempotency_key=f"{self.CONFIRM_KEY_PREFIX}:{ref}",  # stabil per ref → retry webhook tidak dobel order
            )
        except OrderError as e:
            return ChatReply(reply=f"Mohon maaf, pesanan tidak bisa diproses: {e.message}")

        await ConversationService.add_message(
            self.db, conversation_id, sender="CUSTOMER",
            content=content, message_type="BUTTON_REPLY",
            raw_payload={"reply_id": content},
        )
        await ConversationService.set_outcome(self.db, conversation_id, "ORDERED")
        pop_for_conversation(conversation_id)  # summary sudah jadi order — tombol tidak dikirim ulang

        total = float(order.total_amount)
        status_txt = "(sudah diproses sebelumnya)" if replayed else "berhasil dicatat ✅"
        return ChatReply(
            reply=f"Pesanan #{str(order.id)[:8]} {status_txt}. Total: Rp{total:,.0f}. "
            "Terima kasih sudah berbelanja! 🙏"
        )


_seen: set[str] = set()
