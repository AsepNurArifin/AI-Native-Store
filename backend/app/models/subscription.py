from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.security import utcnow
from app.models.base import Base, UUID_PK


class Subscription(Base):
    """Pendaftaran langganan SaaS dari landing page (Fase 2 PLAN_PRODUCT_LAUNCH.md).

    Mock billing: pemilik toko mengisi form publik -> baris PENDING ->
    diaktivasi manual oleh tim (provisioning otomatis = future work).
    """

    __tablename__ = "subscriptions"

    id = UUID_PK()
    store_name: Mapped[str] = mapped_column(String(100), nullable=False)
    owner_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # Email atau nomor WA (divalidasi di schema, disimpan apa adanya)
    contact: Mapped[str] = mapped_column(String(150), nullable=False)
    # trial | monthly | yearly | topup
    plan: Mapped[str] = mapped_column(String(20), nullable=False, default="trial")
    # PENDING (menunggu provisioning manual) | ACTIVATED | REJECTED
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
