"""Base Telegram provider interface — paralel whatsapp/provider_base.py."""

from abc import ABC, abstractmethod

from app.channels.base import InboundMessage


class TelegramProviderBase(ABC):
    @abstractmethod
    def parse_webhook(self, payload: dict) -> InboundMessage | None:
        """Update Telegram (message/callback_query) -> InboundMessage.

        Return None untuk update non-pesan (edited_message, channel_post dll).
        """
        ...

    @abstractmethod
    async def send_message(self, *, recipient_id: str, content: str, interactive: dict | None = None) -> bool:
        """Kirim pesan ke chat_id. `interactive` = {"inline_keyboard": [[...]]}."""
        ...
