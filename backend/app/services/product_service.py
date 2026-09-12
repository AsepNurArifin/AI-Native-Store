import re

from sqlalchemy import Numeric, String, case, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import InventoryTransaction, OrderItem, Product, Promotion
from app.schemas.catalog import ProductCreate, ProductSearchParams, ProductUpdate
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
        ram_min_gb: int | None = None,
        storage_min_gb: int | None = None,
        brand: str | None = None,
        processor: str | None = None,
        gpu: str | None = None,
        limit: int = 20,
    ) -> list[Product]:
        """Keyword AND search + structured specs; stock filtering BEFORE LIMIT.

        This is not a natural-language parser. The agent extracts budget/spec
        constraints into tool arguments. Short queries like 'laptop RAM 16GB'
        are supported too. Missing/malformed numeric specs never match a minimum.
        """
        params = ProductSearchParams(
            query=query, category=category, budget_min=budget_min,
            budget_max=budget_max, ram_min_gb=ram_min_gb,
            storage_min_gb=storage_min_gb, brand=brand, processor=processor,
            gpu=gpu, stock_only=stock_only,
        )
        query = params.query or ""
        # Named units only: don't confuse GPU VRAM or 'iPhone 16' with system RAM.
        for pattern, field in (
            (r"\bram\s*(\d+)\s*gb\b", "ram_min_gb"),
            (r"\b(?:ssd|storage|penyimpanan)\s*(\d+)\s*(gb|tb)\b", "storage_min_gb"),
        ):
            matches = list(re.finditer(pattern, query, flags=re.IGNORECASE))
            for match in matches:
                value = int(match[1])
                if field == "storage_min_gb" and match[2].lower() == "tb":
                    value *= 1000
                setattr(params, field, max(getattr(params, field) or 0, value))
            query = re.sub(pattern, " ", query, flags=re.IGNORECASE)
        params = ProductSearchParams.model_validate(params.model_dump())

        stmt = select(Product)
        if status:
            stmt = stmt.where(Product.status == status)
        if params.category:
            stmt = stmt.where(func.lower(Product.category) == params.category.lower())
        for token in query.split():
            # autoescape treats %, _ and / as literal user input, not wildcards.
            stmt = stmt.where(or_(
                Product.name.icontains(token, autoescape=True),
                Product.category.icontains(token, autoescape=True),
                cast(Product.specification, String).icontains(token, autoescape=True),
            ))
        if params.budget_min is not None:
            stmt = stmt.where(Product.price >= params.budget_min)
        if params.budget_max is not None:
            stmt = stmt.where(Product.price <= params.budget_max)
        for key, minimum in (("ram_gb", params.ram_min_gb), ("storage_gb", params.storage_min_gb)):
            if minimum is not None:
                raw = Product.specification[key].astext
                numeric = case(
                    (raw.op("~")(r"^[0-9]{1,7}([.][0-9]{1,3})?$"), cast(raw, Numeric)),
                    else_=None,
                )
                stmt = stmt.where(numeric >= minimum)
        if params.brand:
            stmt = stmt.where(Product.specification["brand"].astext.icontains(params.brand, autoescape=True))
        if params.processor:
            stmt = stmt.where(or_(
                Product.specification["prosesor"].astext.icontains(params.processor, autoescape=True),
                Product.specification["chipset"].astext.icontains(params.processor, autoescape=True),
            ))
        if params.gpu:
            stmt = stmt.where(Product.specification["gpu"].astext.icontains(params.gpu, autoescape=True))
        if params.stock_only:
            stock = select(func.coalesce(func.sum(case(
                (InventoryTransaction.movement == "IN", InventoryTransaction.quantity),
                else_=-InventoryTransaction.quantity,
            )), 0)).where(InventoryTransaction.product_id == Product.id).scalar_subquery()
            stmt = stmt.where(stock > 0)
        stmt = stmt.order_by(Product.price.asc(), Product.name.asc(), Product.id.asc()).limit(limit)
        return list((await db.execute(stmt)).scalars().all())

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
