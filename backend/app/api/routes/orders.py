from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_owner
from app.db.session import get_session
from app.models import User
from app.schemas.order import OrderOut
from app.services.order_service import OrderError, OrderService

router = APIRouter(prefix="/orders", tags=["orders"], dependencies=[Depends(require_owner)])


@router.get("", response_model=list[OrderOut])
async def list_orders(
    status_: str | None = Query(default=None, alias="status"),
    channel: str | None = Query(default=None, pattern="^(WEB|TELEGRAM)$"),
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_owner),
):
    orders, _ = await OrderService.list(db, status=status_, channel=channel, page=page, page_size=page_size)
    return [await OrderService.get_with_items(db, str(o.id)) for o in orders]


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: str, db: AsyncSession = Depends(get_session), _: User = Depends(require_owner)):
    order = await OrderService.get_with_items(db, order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Order tidak ditemukan")
    return order


@router.post("/{order_id}/complete", response_model=OrderOut)
async def complete_order(order_id: str, db: AsyncSession = Depends(get_session), _: User = Depends(require_owner)):
    order = await OrderService.get_with_items(db, order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Order tidak ditemukan")
    try:
        order = await OrderService.complete(db, order)
    except OrderError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, detail={"code": e.code, "message": e.message})
    return await OrderService.get_with_items(db, str(order.id))


@router.post("/{order_id}/cancel", response_model=OrderOut)
async def cancel_order(order_id: str, db: AsyncSession = Depends(get_session), _: User = Depends(require_owner)):
    order = await OrderService.get_with_items(db, order_id)
    if not order:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Order tidak ditemukan")
    try:
        order = await OrderService.cancel(db, order)
    except OrderError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, detail={"code": e.code, "message": e.message})
    return await OrderService.get_with_items(db, str(order.id))
