from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_owner
from app.db.session import get_session
from app.models import User
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(require_owner)])


@router.get("/sales")
async def sales_analytics(
    from_date: datetime = Query(...),
    to_date: datetime = Query(...),
    group_by: str = Query(default="product", pattern="^(product|day|week|month|channel)$"),
    top: int | None = Query(default=10, ge=1, le=100),
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_owner),
):
    if to_date <= from_date:
        from fastapi import HTTPException

        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="to_date harus setelah from_date")
    return await AnalyticsService.analyze_sales(db, from_date=from_date, to_date=to_date, group_by=group_by, top=top)


@router.get("/inventory")
async def inventory_analytics(
    threshold_days: int | None = Query(default=None, ge=1, le=90),
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_owner),
):
    return await AnalyticsService.analyze_inventory(db, threshold_days=threshold_days)


@router.get("/channels")
async def channel_analytics(
    from_date: datetime = Query(...),
    to_date: datetime = Query(...),
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_owner),
):
    if to_date <= from_date:
        from fastapi import HTTPException

        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="to_date harus setelah from_date")
    return await AnalyticsService.channel_distribution(db, from_date=from_date, to_date=to_date)
