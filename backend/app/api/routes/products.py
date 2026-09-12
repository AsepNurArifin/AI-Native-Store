from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_owner
from app.db.session import get_session
from app.models import Product, User
from app.schemas.catalog import ProductCreate, ProductOut, ProductUpdate
from app.services.product_service import ProductInUseError, ProductNotFound, ProductService

router = APIRouter(prefix="/products", tags=["products"], dependencies=[Depends(require_owner)])


@router.get("", response_model=list[ProductOut])
async def list_products(
    q: str | None = Query(default=None, max_length=200),
    category: str | None = Query(default=None, max_length=50),
    status: str | None = Query(default="ACTIVE", pattern="^(ACTIVE|INACTIVE)$"),
    budget_min: float | None = Query(default=None, ge=0),
    budget_max: float | None = Query(default=None, ge=0),
    ram_min_gb: int | None = Query(default=None, ge=1, le=4096),
    storage_min_gb: int | None = Query(default=None, ge=1, le=1_000_000),
    brand: str | None = Query(default=None, max_length=100),
    processor: str | None = Query(default=None, max_length=100),
    gpu: str | None = Query(default=None, max_length=100),
    stock_only: bool = False,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_owner),
):
    try:
        products = await ProductService.search(
            db, query=q, category=category, status=status, stock_only=stock_only,
            budget_min=budget_min, budget_max=budget_max, ram_min_gb=ram_min_gb,
            storage_min_gb=storage_min_gb, brand=brand, processor=processor, gpu=gpu,
            limit=500,
        )
    except ValidationError:
        raise HTTPException(status_code=422, detail="Filter pencarian tidak valid; periksa rentang budget dan spesifikasi.")
    return [await ProductService.with_stock(db, p) for p in products]


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(body: ProductCreate, db: AsyncSession = Depends(get_session), _: User = Depends(require_owner)):
    product = await ProductService.create(db, body)
    await db.commit()
    return await ProductService.with_stock(db, product)


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: str, db: AsyncSession = Depends(get_session), _: User = Depends(require_owner)):
    try:
        product = await ProductService.get_or_404(db, product_id)
    except ProductNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Produk tidak ditemukan")
    return await ProductService.with_stock(db, product)


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(product_id: str, body: ProductUpdate, db: AsyncSession = Depends(get_session), _: User = Depends(require_owner)):
    try:
        product = await ProductService.get_or_404(db, product_id)
    except ProductNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Produk tidak ditemukan")
    product = await ProductService.update(db, product, body)
    await db.commit()
    return await ProductService.with_stock(db, product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: str, db: AsyncSession = Depends(get_session), _: User = Depends(require_owner)):
    try:
        product = await ProductService.get_or_404(db, product_id)
        await ProductService.delete(db, product)
        await db.commit()
    except ProductNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Produk tidak ditemukan")
    except ProductInUseError as e:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "code": "PRODUCT_IN_USE",
                "message": "Produk sudah pernah dipakai — ubah status menjadi INACTIVE.",
                "references": e.references,
            },
        )
