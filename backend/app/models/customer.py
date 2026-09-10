import enum

from sqlalchemy import DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.security import utcnow
from app.models.base import Base, UUID_PK


class CustomerChannel(str, enum.Enum):
    WEB = "WEB"
    WHATSAPP = "WHATSAPP"


class Customer(Base):
    """FR-SMS-04a — channel-specific identity (BR-10). No cross-channel unification in MVP."""

    __tablename__ = "customers"
    __table_args__ = (UniqueConstraint("channel", "identifier", name="uq_customer_channel_identifier"),)

    id = UUID_PK()
    channel: Mapped[str] = mapped_column(String(10), nullable=False)
    identifier: Mapped[str] = mapped_column(String(150), nullable=False)  # WEB: name|contact | WA: phone
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    contact: Mapped[str | None] = mapped_column(String(100), nullable=True)
    registered_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
