from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_owner
from app.db.session import get_session
from app.models import Product, User
from app.schemas.catalog import ProductCreate, ProductOut, ProductUpdate
from app.services.product_service import ProductInUseError, ProductNotFound, ProductService

router = APIRouter(prefix="/products", tags=["products"], dependencies=[Depends(require_owner)])


@router.get("", response_model=list[ProductOut])
async def list_products(
    q: str | None = None,
    category: str | None = None,
    status: str | None = Query(default="ACTIVE", pattern="^(ACTIVE|INACTIVE)$"),
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_owner),
):
    products = await ProductService.search(db, query=q, category=category, status=status, stock_only=False, limit=500)
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
