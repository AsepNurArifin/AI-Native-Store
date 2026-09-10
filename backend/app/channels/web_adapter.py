"""Web Chat adapter — channel WEB (FR-SMS-07/08)."""

from dataclasses import asdict

from sqlalchemy.ext.asyncio import AsyncSession

from app.channels.base import InboundMessage, OutboundMessage


class WebAdapter:
    def __init__(self, db: AsyncSession):
        self.db = db

    def to_inbound(self, conversation_id: str, content: str) -> InboundMessage:
        return InboundMessage(channel="WEB", sender_id=conversation_id, content=content)

    def to_outbound(self, recipient_id: str, content: str) -> OutboundMessage:
        return OutboundMessage(channel="WEB", recipient_id=recipient_id, content=content)

    def serialize(self, outbound: OutboundMessage) -> dict:
        return asdict(outbound)
