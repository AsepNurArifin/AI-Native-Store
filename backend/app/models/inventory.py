import enum

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.security import utcnow
from app.models.base import Base, UUID_PK


class InvType(str, enum.Enum):
    IN = "IN"
    OUT = "OUT"
    ADJUSTMENT = "ADJUSTMENT"


class InvMovement(str, enum.Enum):
    IN = "IN"
    OUT = "OUT"


class InvReferenceType(str, enum.Enum):
    MANUAL = "MANUAL"
    ORDER = "ORDER"
    CANCELLATION = "CANCELLATION"


class InventoryTransaction(Base):
    """FR-SMS-02 — every stock movement is an InventoryTransaction row.

    current_stock is NEVER a column; it is always aggregated:
    SUM(quantity WHERE movement=IN) - SUM(quantity WHERE movement=OUT)
    """

    __tablename__ = "inventory_transactions"

    id = UUID_PK()
    product_id: Mapped[str] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(12), nullable=False, default=InvType.IN.value)
    movement: Mapped[str] = mapped_column(String(3), nullable=False)  # IN | OUT
    reference_type: Mapped[str] = mapped_column(
        String(12), nullable=False, default=InvReferenceType.MANUAL.value
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)  # always positive
    reference_id: Mapped[str | None] = mapped_column(UUID(as_uuid=True), nullable=True)  # order id etc.
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    timestamp: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
