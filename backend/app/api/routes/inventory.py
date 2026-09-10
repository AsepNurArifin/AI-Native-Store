from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_staff_or_owner
from app.db.session import get_session
from app.models import InventoryTransaction, Product, User
from app.schemas.inventory import AdjustmentCreate, InventoryTransactionOut, StockSummaryItem
from app.services.inventory_service import InventoryService
from app.services.product_service import ProductNotFound, ProductService

router = APIRouter(prefix="/inventory", tags=["inventory"], dependencies=[Depends(require_staff_or_owner)])


@router.get("/summary", response_model=list[StockSummaryItem])
async def stock_summary(db: AsyncSession = Depends(get_session), _: User = Depends(require_staff_or_owner)):
    return await InventoryService.stock_summary(db)


@router.get("/transactions", response_model=list[InventoryTransactionOut])
async def list_transactions(
    product_id: str | None = None,
    type_: str | None = Query(default=None, alias="type"),
    movement: str | None = Query(default=None, pattern="^(IN|OUT)$"),
    limit: int = Query(default=100, le=500),
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_staff_or_owner),
):
    stmt = select(InventoryTransaction).order_by(InventoryTransaction.timestamp.desc()).limit(limit)
    if product_id:
        stmt = stmt.where(InventoryTransaction.product_id == product_id)
    if type_:
        stmt = stmt.where(InventoryTransaction.type == type_)
    if movement:
        stmt = stmt.where(InventoryTransaction.movement == movement)
    rows = (await db.execute(stmt)).scalars().all()
    return list(rows)


@router.post("/adjustments", response_model=InventoryTransactionOut, status_code=status.HTTP_201_CREATED)
async def create_adjustment(body: AdjustmentCreate, db: AsyncSession = Depends(get_session), user: User = Depends(require_staff_or_owner)):
    """FR-SMS-02 — manual adjustment: type=ADJUSTMENT, movement IN|OUT (explicit)."""
    try:
        product = await ProductService.get_or_404(db, body.product_id)
    except ProductNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Produk tidak ditemukan")
    tx = await InventoryService.record(
        db,
        product_id=str(product.id),
        type_="ADJUSTMENT",
        movement=body.movement,
        reference_type="MANUAL",
        quantity=body.quantity,
        actor_id=str(user.id),
    )
    await db.commit()
    await db.refresh(tx)
    return tx
