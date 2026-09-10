"""Base WhatsApp provider interface."""

from abc import ABC, abstractmethod

from app.channels.base import InboundMessage


class WhatsAppProviderBase(ABC):
    @abstractmethod
    def parse_webhook(self, payload: dict) -> InboundMessage | None:
        ...

    @abstractmethod
    async def send_message(self, *, recipient_id: str, content: str, interactive: dict | None = None) -> bool:
        ...
