"""Telegram adapter — webhook Update -> InboundMessage -> SalesAgent -> balas via Bot API.

Seluruh alur routing (dedupe, CONFIRM/CANCEL, SalesAgent, reuse sesi)
diwarisi dari MessagingChannelAdapter — subclass ini hanya bagian
channel-specific: provider (mock/bot), verifikasi secret token,
ekstraksi nama dari profil Telegram, dan tombol inline keyboard.
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.channels.base import InboundMessage
from app.channels.messaging_base import MessagingChannelAdapter
from app.channels.telegram.provider_bot import BotTelegramProvider
from app.channels.telegram.provider_mock import MockTelegramProvider
from app.core.config import settings
from app.schemas.chat import ChatReply

logger = logging.getLogger(__name__)


class TelegramAdapter(MessagingChannelAdapter):
    CHANNEL = "TELEGRAM"
    CONFIRM_KEY_PREFIX = "tg"

    def __init__(self, db: AsyncSession):
        super().__init__(db, self._build_provider())

    def verify_request(self, secret_header: str | None) -> bool:
        """P5 — verifikasi header `X-Telegram-Bot-Api-Secret-Token`.

        Mock provider tidak punya verify_secret -> terima (dev/test).
        Bot provider fail-closed tanpa secret terkonfigurasi.
        """
        verifier = getattr(self.provider, "verify_secret", None)
        if verifier is None:
            return True
        try:
            return bool(verifier(secret_header))
        except Exception:  # noqa: BLE001 — secret invalid tidak boleh crash route
            logger.warning("telegram webhook secret verification error")
            return False

    def _build_provider(self):
        provider = (settings.telegram_provider or "mock").lower()
        if provider == "bot":
            return BotTelegramProvider()
        return MockTelegramProvider()

    def _customer_name(self, msg: InboundMessage) -> str:
        """Nama tampilan dari profil Telegram (first_name), fallback chat id."""
        source = msg.raw.get("message") or msg.raw.get("callback_query") or {}
        frm = source.get("from") or {}
        return frm.get("first_name") or msg.sender_id

    def _build_confirm_buttons(self, reply: ChatReply) -> dict | None:
        """Inline keyboard konfirmasi order (UC-02 E5) — hanya jika ada summary."""
        if not reply.order_summary:
            return None
        return {
            "inline_keyboard": [
                [
                    {"text": "✅ Konfirmasi", "callback_data": f"CONFIRM:{reply.order_summary.summary_ref}"},
                    {"text": "❌ Batalkan", "callback_data": "CANCEL"},
                ]
            ]
        }
