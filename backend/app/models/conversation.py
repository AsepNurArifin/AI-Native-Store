import enum

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.security import utcnow
from app.models.base import Base, UUID_PK


class ConversationStatus(str, enum.Enum):
    OPEN = "OPEN"
    ORDERED = "ORDERED"
    NO_MATCH = "NO_MATCH"
    ABANDONED = "ABANDONED"
    ERROR = "ERROR"


class SenderType(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    AI = "AI"


class Conversation(Base):
    __tablename__ = "conversations"

    id = UUID_PK()
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(10), nullable=False)  # WEB | TELEGRAM | WHATSAPP (FR-SMS-08)
    started_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_activity_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    ended_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    outcome: Mapped[str | None] = mapped_column(String(20), nullable=True)


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = UUID_PK()
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender: Mapped[str] = mapped_column(String(10), nullable=False)  # CUSTOMER | AI
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_type: Mapped[str] = mapped_column(String(12), nullable=False, default="TEXT")
    raw_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    timestamp: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = UUID_PK()
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
