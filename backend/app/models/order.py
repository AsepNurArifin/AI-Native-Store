import enum

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.security import utcnow
from app.models.base import Base, UUID_PK


class OrderStatus(str, enum.Enum):
    DRAFT = "DRAFT"  # transient internal — never persists (SRS §8.1)
    CONFIRMED = "CONFIRMED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Order(Base):
    """FR-SMS-06 — created directly from Order Summary at explicit confirmation (no Cart)."""

    __tablename__ = "orders"

    id = UUID_PK()
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default=OrderStatus.CONFIRMED.value)
    conversation_id: Mapped[str | None] = mapped_column(ForeignKey("conversations.id"), nullable=True)
    channel_origin: Mapped[str] = mapped_column(String(10), nullable=False)  # WEB | TELEGRAM | WHATSAPP
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    promotion_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # {method: PICKUP|DELIVERY, recipient?, phone?, address?, notes?} — dipilih
    # pembeli saat konfirmasi (channel WEB); None = channel tanpa pilihan fulfillment
    fulfillment: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    completed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class OrderItem(Base):
    __tablename__ = "order_items"

    id = UUID_PK()
    order_id: Mapped[str] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(nullable=False)  # > 0 validated in service
    price_at_order: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)  # snapshot — SRS §6.2
    line_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
