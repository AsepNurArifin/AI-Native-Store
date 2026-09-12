from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import InventoryTransaction, OrderItem, Product, Promotion
from app.schemas.catalog import ProductCreate, ProductUpdate
from app.services.inventory_service import InventoryService


class ProductNotFound(Exception):
    pass


class ProductInUseError(Exception):
    """FR-SMS-01 — delete rejected when referenced by OrderItem/Promotion/InventoryTransaction."""

    def __init__(self, references: list[str]):
        self.references = references
        super().__init__("product is referenced by business records")


class ProductService:
    @staticmethod
    async def create(db: AsyncSession, data: ProductCreate) -> Product:
        product = Product(**data.model_dump())
        db.add(product)
        await db.flush()
        return product

    @staticmethod
    async def get(db: AsyncSession, product_id: str) -> Product | None:
        return await db.get(Product, product_id)

    @staticmethod
    async def get_or_404(db: AsyncSession, product_id: str) -> Product:
        product = await ProductService.get(db, product_id)
        if not product:
            raise ProductNotFound(product_id)
        return product

    @staticmethod
    async def update(db: AsyncSession, product: Product, data: ProductUpdate) -> Product:
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(product, k, v)
        await db.flush()
        return product

    @staticmethod
    async def delete(db: AsyncSession, product: Product) -> None:
        """FR-SMS-01 — allowed only when product never referenced."""
        references: list[str] = []
        if (await db.execute(select(OrderItem.id).where(OrderItem.product_id == product.id).limit(1))).scalar_one_or_none():
            references.append("order_items")
        if (await db.execute(select(Promotion.id).where(Promotion.product_id == product.id).limit(1))).scalar_one_or_none():
            references.append("promotions")
        if (await db.execute(select(InventoryTransaction.id).where(InventoryTransaction.product_id == product.id).limit(1))).scalar_one_or_none():
            references.append("inventory_transactions")
        if references:
            raise ProductInUseError(references)
        await db.delete(product)
        await db.flush()

    @staticmethod
    async def search(
        db: AsyncSession,
        *,
        query: str | None = None,
        category: str | None = None,
        status: str | None = "ACTIVE",
        stock_only: bool = False,
        budget_min: float | None = None,
        budget_max: float | None = None,
        limit: int = 20,
    ) -> list[Product]:
        """FR-SA-02 — stock-aware search for Sales Agent (ACTIVE + stock>0 when stock_only)."""
        stmt = select(Product).where(Product.status == "ACTIVE") if status == "ACTIVE" else select(Product)
        if status and status != "ACTIVE":
            stmt = select(Product).where(Product.status == status)
        if category:
            stmt = stmt.where(Product.category == category)
        if query:
            stmt = stmt.where(Product.name.ilike(f"%{query}%"))
        if budget_min is not None:
            stmt = stmt.where(Product.price >= budget_min)
        if budget_max is not None:
            stmt = stmt.where(Product.price <= budget_max)
        stmt = stmt.order_by(Product.price.asc()).limit(limit)
        products = (await db.execute(stmt)).scalars().all()
        if not stock_only:
            return list(products)
        out = []
        for p in products:
            stock = await InventoryService.current_stock(db, str(p.id))
            if stock > 0:
                out.append(p)
        return out

    @staticmethod
    async def with_stock(db: AsyncSession, product: Product) -> dict:
        stock = await InventoryService.current_stock(db, str(product.id))
        threshold = (
            product.low_stock_threshold
            if product.low_stock_threshold is not None
            else settings.low_stock_threshold_default
        )
        return {
            "id": str(product.id),
            "name": product.name,
            "category": product.category,
            "specification": product.specification,
            "price": float(product.price),
            "status": product.status,
            "low_stock_threshold": threshold,
            "current_stock": stock,
            "is_low_stock": stock <= threshold,
        }
