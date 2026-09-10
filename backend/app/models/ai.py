import enum

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.security import utcnow
from app.models.base import Base, UUID_PK


class AIActionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    APPROVED_VALIDATION_FAILED = "APPROVED_VALIDATION_FAILED"
    EXECUTED = "EXECUTED"


class AIAction(Base):
    __tablename__ = "ai_actions"

    id = UUID_PK()
    action_type: Mapped[str] = mapped_column(String(30), nullable=False)  # CREATE_PROMOTION
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(28), nullable=False, default=AIActionStatus.DRAFT.value)
    requested_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    decided_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    executed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    result_target_id: Mapped[str | None] = mapped_column(nullable=True)  # promotion id
    validation_failures: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class Approval(Base):
    __tablename__ = "approvals"

    id = UUID_PK()
    ai_action_id: Mapped[str] = mapped_column(
        ForeignKey("ai_actions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)  # must be OWNER
    decision: Mapped[str] = mapped_column(String(10), nullable=False)  # APPROVED | REJECTED
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class AuditEvent(str, enum.Enum):
    CREATED = "CREATED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    VALIDATION_FAILED = "VALIDATION_FAILED"
    EXECUTED = "EXECUTED"


class ActorType(str, enum.Enum):
    USER = "USER"
    AI_SYSTEM = "AI_SYSTEM"


class AuditLog(Base):
    """FR-AA-04 — single append-only log of the whole AI Action lifecycle."""

    __tablename__ = "audit_logs"

    id = UUID_PK()
    ai_action_id: Mapped[str | None] = mapped_column(ForeignKey("ai_actions.id"), nullable=True)
    event: Mapped[str] = mapped_column(String(20), nullable=False)
    actor_type: Mapped[str] = mapped_column(String(10), nullable=False)  # USER | AI_SYSTEM
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    detail: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    timestamp: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)


class IdempotencyKey(Base):
    """UC-02 E5 — prevents duplicate order from double-click confirm."""

    __tablename__ = "idempotency_keys"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    order_id: Mapped[str | None] = mapped_column(ForeignKey("orders.id"), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
