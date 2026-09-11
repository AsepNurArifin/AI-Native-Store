"""WhatsApp adapter — normalisasi webhook Meta -> InboundMessage -> SalesAgent -> kirim balasan.

Provider disuntik dari env WA_PROVIDER (mock | meta):
- mock: dev/test tanpa API nyata (5 kontak uji via wa_test_numbers)
- meta : Meta Cloud API (WABA resmi, F7)

Alur routing (parse -> dedupe -> CONFIRM/CANCEL/SalesAgent -> balas) kini
berada di MessagingChannelAdapter (dipakai bersama Telegram, Fase 3
PLAN_PRODUCT_LAUNCH.md) — subclass ini hanya menyediakan bagian
channel-specific: provider, verifikasi signature, nama channel, dan format
tombol interactive Meta.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.channels.messaging_base import MessagingChannelAdapter
from app.channels.whatsapp.provider_meta import MetaCloudWhatsAppProvider
from app.channels.whatsapp.provider_mock import MockWhatsAppProvider
from app.core.config import settings
from app.schemas.chat import ChatReply

logger = logging.getLogger(__name__)


class WhatsAppAdapter(MessagingChannelAdapter):
    CHANNEL = "WHATSAPP"
    CONFIRM_KEY_PREFIX = "wa"

    def __init__(self, db: AsyncSession):
        super().__init__(db, self._build_provider())

    def verify_request(self, body: bytes, signature_header: str | None) -> bool:
        """P5/F7 — verifikasi X-Hub-Signature-256 untuk provider Meta.

        Mock provider tidak punya verify_signature -> terima (dev/test).
        Provider Meta menolak request tanpa/invalid signature.
        """
        verifier = getattr(self.provider, "verify_signature", None)
        if verifier is None:
            return True
        try:
            return bool(verifier(body, signature_header))
        except Exception:  # noqa: BLE001 — signature invalid tidak boleh crash route
            logger.warning("webhook signature verification error")
            return False

    def _build_provider(self):
        provider = (settings.wa_provider or "mock").lower()
        if provider == "meta":
            return MetaCloudWhatsAppProvider()
        return MockWhatsAppProvider()

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
