from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_owner
from app.core.rate_limit import rate_limit
from app.db.session import get_session
from app.models import Subscription, User
from app.schemas.subscription import SubscriptionCreate, SubscriptionOut

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.post(
    "",
    response_model=SubscriptionOut,
    status_code=status.HTTP_201_CREATED,
    # P5: form publik — 5 pendaftaran / menit / IP (cukup ketat untuk demo,
    # longgar cukup untuk manusia yang salah-salah ketik).
    dependencies=[Depends(rate_limit(max_requests=5, window_seconds=60))],
)
async def create_subscription(
    payload: SubscriptionCreate,
    db: AsyncSession = Depends(get_session),
):
    """Endpoint publik funnel subscribe (Fase 2 PLAN_PRODUCT_LAUNCH.md).

    Mock billing: hanya mencatat pendaftaran (status PENDING).
    Provisioning/aktivasi dilakukan manual oleh tim — future work.
    """
    sub = Subscription(
        store_name=payload.store_name,
        owner_name=payload.owner_name,
        contact=payload.contact,
        plan=payload.plan,
        status="PENDING",
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


@router.get("", response_model=list[SubscriptionOut], dependencies=[Depends(require_owner)])
async def list_subscriptions(db: AsyncSession = Depends(get_session), _: User = Depends(require_owner)):
    """Daftar pendaftar (panel admin) — terbaru dulu."""
    rows = (
        await db.execute(select(Subscription).order_by(Subscription.created_at.desc()).limit(200))
    ).scalars().all()
    return list(rows)
