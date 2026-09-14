"""Katalog publik (tanpa JWT) — dipakai halaman rak storefront.

Berbeda dari /products (admin-only, semua filter): endpoint ini hanya
mengekspos produk ACTIVE + stok, cukup untuk pembeli melihat isi rak
sebelum masuk chat (FR-SMS-07 konteks storefront).
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models import Product
from app.schemas.catalog import ProductOut
from app.services.product_service import ProductService

router = APIRouter(prefix="/catalog", tags=["catalog"])


@router.get("/categories", response_model=list[str])
async def list_categories(db: AsyncSession = Depends(get_session)):
    result = await db.execute(
        select(Product.category)
        .where(Product.status == "ACTIVE")
        .distinct()
        .order_by(Product.category)
    )
    return list(result.scalars().all())


@router.get("/products", response_model=list[ProductOut])
async def list_products(
    category: str | None = Query(default=None, max_length=50),
    stock_only: bool = False,
    db: AsyncSession = Depends(get_session),
):
    if not category:
        raise HTTPException(status_code=422, detail="Parameter category wajib diisi (mis. ?category=Laptop).")
    try:
        products = await ProductService.search(
            db, query=None, category=category, status="ACTIVE",
            stock_only=stock_only, limit=200,
        )
    except Exception:
        raise HTTPException(status_code=422, detail="Filter kategori tidak valid.")
    return [await ProductService.with_stock(db, p) for p in products]
