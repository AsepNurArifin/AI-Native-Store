import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import utcnow
from app.models import (
    Conversation,
    ConversationMessage,
    Customer,
    Recommendation,
)


class ConversationService:
    """FR-SMS-07/08/09 — session model: Conversation + Messages + Recommendations."""

    @staticmethod
    async def ensure_customer(
        db: AsyncSession, *, channel: str, identifier: str, name: str, contact: str | None = None
    ) -> Customer:
        customer = (
            await db.execute(
                select(Customer).where(Customer.channel == channel, Customer.identifier == identifier)
            )
        ).scalar_one_or_none()
        if not customer:
            customer = Customer(channel=channel, identifier=identifier, name=name, contact=contact)
            db.add(customer)
            await db.flush()
        return customer

    @staticmethod
    async def create(db: AsyncSession, customer: Customer, channel: str) -> Conversation:
        conv = Conversation(customer_id=str(customer.id), channel=channel, outcome="OPEN")
        db.add(conv)
        await db.flush()
        return conv

    @staticmethod
    async def get(db: AsyncSession, conversation_id: str) -> Conversation | None:
        return await db.get(Conversation, conversation_id)

    @staticmethod
    async def find_open(db: AsyncSession, customer: Customer, channel: str) -> Conversation | None:
        """FR-SMS-07 — percakapan OPEN terakhir milik customer pada channel ini.

        Dipakai channel WhatsApp supaya konteks sesi tidak terputus per pesan
        (setiap pesan masuk TIDAK membuat conversation baru).
        """
        return (
            await db.execute(
                select(Conversation)
                .where(
                    Conversation.customer_id == str(customer.id),
                    Conversation.channel == channel,
                    Conversation.outcome == "OPEN",
                )
                .order_by(Conversation.last_activity_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

    @staticmethod
    async def add_message(
        db: AsyncSession,
        conversation_id: str,
        *,
        sender: str,
        content: str,
        message_type: str = "TEXT",
        raw_payload: dict | None = None,
    ) -> ConversationMessage:
        msg = ConversationMessage(
            conversation_id=conversation_id,
            sender=sender,
            content=content,
            message_type=message_type,
            raw_payload=raw_payload,
        )
        db.add(msg)
        conv = await db.get(Conversation, conversation_id)
        if conv:
            conv.last_activity_at = utcnow()
            if sender == "CUSTOMER":
                conv.outcome = "OPEN"
        await db.flush()
        return msg

    @staticmethod
    async def add_recommendation(
        db: AsyncSession, conversation_id: str, product_id: str, reason: str
    ) -> Recommendation:
        rec = Recommendation(conversation_id=conversation_id, product_id=product_id, reason=reason)
        db.add(rec)
        await db.flush()
        return rec

    @staticmethod
    async def set_outcome(db: AsyncSession, conversation_id: str, outcome: str) -> None:
        conv = await db.get(Conversation, conversation_id)
        if conv:
            conv.outcome = outcome

    @staticmethod
    async def list_conversations(
        db: AsyncSession, *, channel: str | None = None, page: int = 1, page_size: int = 20
    ) -> tuple[list[Conversation], int]:
        stmt = select(Conversation).order_by(Conversation.last_activity_at.desc())
        if channel:
            stmt = stmt.where(Conversation.channel == channel)
        total = len((await db.execute(stmt)).scalars().all())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await db.execute(stmt)).scalars().all()
        return list(rows), total

    @staticmethod
    async def detail(
        db: AsyncSession, conversation_id: str
    ) -> tuple[Conversation, list[ConversationMessage], list[Recommendation]] | None:
        conv = await db.get(Conversation, conversation_id)
        if not conv:
            return None
        messages = (
            (await db.execute(
                select(ConversationMessage)
                .where(ConversationMessage.conversation_id == conversation_id)
                .order_by(ConversationMessage.timestamp.asc())
            )).scalars().all()
        )
        recs = (
            (await db.execute(
                select(Recommendation).where(Recommendation.conversation_id == conversation_id)
            )).scalars().all()
        )
        return conv, list(messages), list(recs)
