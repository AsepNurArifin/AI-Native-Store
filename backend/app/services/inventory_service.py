from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import InventoryTransaction, Product


class InventoryService:
    """FR-SMS-02/03 — current_stock is ALWAYS aggregated from InventoryTransaction."""

    @staticmethod
    async def current_stock(db: AsyncSession, product_id: str) -> int:
        stmt = select(
            func.coalesce(
                func.sum(
                    case(
                        (InventoryTransaction.movement == "IN", InventoryTransaction.quantity),
                        else_=-InventoryTransaction.quantity,
                    )
                ),
                0,
            )
        ).where(InventoryTransaction.product_id == product_id)
        return int((await db.execute(stmt)).scalar_one())

    @staticmethod
    async def record(
        db: AsyncSession,
        *,
        product_id: str,
        type_: str,
        movement: str,
        reference_type: str,
        quantity: int,
        reference_id: str | None = None,
        actor_id: str | None = None,
    ) -> InventoryTransaction:
        assert quantity > 0, "quantity must be positive"
        tx = InventoryTransaction(
            product_id=product_id,
            type=type_,
            movement=movement,
            reference_type=reference_type,
            quantity=quantity,
            reference_id=reference_id,
            actor_id=actor_id,
        )
        db.add(tx)
        await db.flush()
        return tx

    @staticmethod
    async def stock_summary(db: AsyncSession, threshold_override: int | None = None) -> list[dict]:
        """All products + current_stock + low-stock flag (FR-SMS-03)."""
        products = (await db.execute(select(Product).order_by(Product.name))).scalars().all()
        threshold = threshold_override or settings.low_stock_threshold_default
        out = []
        for p in products:
            stock = await InventoryService.current_stock(db, str(p.id))
            thr = p.low_stock_threshold if p.low_stock_threshold is not None else threshold
            out.append(
                {
                    "product_id": str(p.id),
                    "name": p.name,
                    "category": p.category,
                    "price": float(p.price),
                    "current_stock": stock,
                    "low_stock_threshold": thr,
                    "is_low_stock": stock <= thr,
                }
            )
        return out
