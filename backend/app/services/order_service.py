import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import utcnow
from app.models import (
    Customer,
    IdempotencyKey,
    InventoryTransaction,
    Order,
    OrderItem,
    Product,
    Promotion,
)
from app.services.inventory_service import InventoryService
from app.services.product_service import ProductNotFound, ProductService


class OrderError(Exception):
    """Generic order failure with a stable error code for the UI."""

    def __init__(self, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


class OrderService:
    """FR-SMS-06 — atomic direct order creation from Order Summary (no Cart, C7)."""

    # ---- active promotions helper (fresh read) ----
    @staticmethod
    async def _active_promotion(db: AsyncSession, product_id: str) -> Promotion | None:
        stmt = select(Promotion).where(
            Promotion.product_id == product_id,
            Promotion.status == "ACTIVE",
            Promotion.start_date <= utcnow(),
            Promotion.end_date > utcnow(),
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    # ---- idempotency (UC-02 E5) ----
    @staticmethod
    async def _check_idempotency(db: AsyncSession, key: str) -> IdempotencyKey | None:
        return await db.get(IdempotencyKey, key)

    @staticmethod
    async def create_from_summary(
        db: AsyncSession,
        *,
        conversation_id: str | None,
        channel: str,
        customer_identity: dict,  # {channel, identifier, name, contact?}
        items: list[dict],  # [{product_id, quantity}]
        idempotency_key: str | None = None,
    ) -> tuple[Order, bool]:
        """One atomic operation: validate stock+price -> Order + OrderItems +
        InventoryTransaction(OUT). Returns (order, replayed).
        """
        if idempotency_key:
            existing = await OrderService._check_idempotency(db, idempotency_key)
            if existing:
                if existing.order_id:
                    order = await db.get(Order, existing.order_id)
                    if order:
                        return order, True
        if not items:
            raise OrderError("EMPTY_ORDER", "Tidak ada item untuk dipesan.")

        # lock product rows to prevent overselling (FR-SMS-06 concurrency)
        product_ids = [i["product_id"] for i in items]
        products = (
            (await db.execute(select(Product).where(Product.id.in_(product_ids)).with_for_update())).scalars().all()
        )
        product_map = {str(p.id): p for p in products}

        # customer (channel-specific identity — FR-SMS-04a, BR-10)
        customer = (
            await db.execute(
                select(Customer).where(
                    Customer.channel == customer_identity["channel"],
                    Customer.identifier == customer_identity["identifier"],
                )
            )
        ).scalar_one_or_none()
        if not customer:
            customer = Customer(**customer_identity)
            db.add(customer)
            await db.flush()

        order = Order(
            customer_id=str(customer.id),
            status="CONFIRMED",
            conversation_id=conversation_id,
            channel_origin=channel,
            total_amount=0,
        )
        db.add(order)
        await db.flush()

        total = 0.0
        promo_snapshot = {}
        for item in items:
            product = product_map.get(item["product_id"])
            if not product:
                await db.rollback()
                raise OrderError("PRODUCT_NOT_FOUND", f"Produk {item['product_id']} tidak ditemukan.")
            if product.status != "ACTIVE":
                pname = product.name
                await db.rollback()
                raise OrderError("PRODUCT_INACTIVE", f"{pname} tidak aktif.")
            stock = await InventoryService.current_stock(db, str(product.id))
            if stock < item["quantity"]:
                pname = product.name
                pid_str = str(product.id)
                await db.rollback()
                raise OrderError(
                    "INSUFFICIENT_STOCK",
                    f"Stok {pname} hanya tersisa {stock}.",
                    {"product_id": pid_str, "available": stock},
                )
            # apply active promotion (fresh read; BR-08)
            promo = await OrderService._active_promotion(db, str(product.id))
            discount = 0.0
            if promo:
                discount = round(float(product.price) * float(promo.discount_percentage) / 100.0, 2)
                promo_snapshot[str(product.id)] = {
                    "promotion_id": str(promo.id),
                    "discount_percentage": float(promo.discount_percentage),
                }
            unit_effective = max(float(product.price) - discount, 0.0)
            line_total = round(unit_effective * item["quantity"], 2)
            total += line_total
            db.add(
                OrderItem(
                    order_id=str(order.id),
                    product_id=str(product.id),
                    quantity=item["quantity"],
                    price_at_order=float(product.price),
                    line_total=line_total,
                )
            )
            # stock effect: OUT / OUT / ORDER (FR-SMS-06)
            await InventoryService.record(
                db,
                product_id=str(product.id),
                type_="OUT",
                movement="OUT",
                reference_type="ORDER",
                quantity=item["quantity"],
                reference_id=str(order.id),
            )

        order.total_amount = round(total, 2)
        order.promotion_snapshot = promo_snapshot or None
        if idempotency_key:
            db.add(IdempotencyKey(key=idempotency_key, order_id=str(order.id)))
        await db.commit()
        await db.refresh(order)
        return order, False

    @staticmethod
    async def cancel(db: AsyncSession, order: Order) -> Order:
        """CONFIRMED -> CANCELLED + InventoryTransaction(ADJUSTMENT, IN, CANCELLATION) (FR-SMS-06)."""
        if order.status != "CONFIRMED":
            raise OrderError("INVALID_STATE", f"Order berstatus {order.status} tidak bisa dibatalkan.")
        items = (await db.execute(select(OrderItem).where(OrderItem.order_id == order.id))).scalars().all()
        for it in items:
            await InventoryService.record(
                db,
                product_id=str(it.product_id),
                type_="ADJUSTMENT",
                movement="IN",
                reference_type="CANCELLATION",
                quantity=it.quantity,
                reference_id=str(order.id),
            )
        order.status = "CANCELLED"
        order.cancelled_at = utcnow()
        await db.commit()
        await db.refresh(order)
        return order

    @staticmethod
    async def complete(db: AsyncSession, order: Order) -> Order:
        if order.status != "CONFIRMED":
            raise OrderError("INVALID_STATE", f"Order berstatus {order.status} tidak bisa diselesaikan.")
        order.status = "COMPLETED"
        order.completed_at = utcnow()
        await db.commit()
        await db.refresh(order)
        return order

    @staticmethod
    async def list(
        db: AsyncSession,
        *,
        status: str | None = None,
        channel: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Order], int]:
        stmt = select(Order).order_by(Order.created_at.desc())
        if status:
            stmt = stmt.where(Order.status == status)
        if channel:
            stmt = stmt.where(Order.channel_origin == channel)
        total = len((await db.execute(stmt)).scalars().all())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await db.execute(stmt)).scalars().all()
        return list(rows), total

    @staticmethod
    async def get_with_items(db: AsyncSession, order_id: str) -> Order | None:
        order = await db.get(Order, order_id)
        if not order:
            return None
        items = (await db.execute(select(OrderItem).where(OrderItem.order_id == order_id))).scalars().all()
        order.items = list(items)  # type: ignore[attr-defined]
        return order
