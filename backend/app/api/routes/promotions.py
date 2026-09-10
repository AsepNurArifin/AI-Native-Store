from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_owner
from app.db.session import get_session
from app.models import Promotion, User
from app.schemas.catalog import PromotionCreate, PromotionOut, PromotionUpdate
from app.services.product_service import ProductNotFound, ProductService
from app.services.promotion_service import PromotionNotFoundError, PromotionOverlapError, PromotionService

router = APIRouter(prefix="/promotions", tags=["promotions"], dependencies=[Depends(require_owner)])


@router.get("", response_model=list[PromotionOut])
async def list_promotions(product_id: str | None = None, db: AsyncSession = Depends(get_session), _: User = Depends(require_owner)):
    rows = await PromotionService.list(db, product_id=product_id)
    out = []
    for r in rows:
        data = PromotionOut.model_validate(r)
        data.status = PromotionService.effective_status(r)
        out.append(data)
    return out


@router.post("", response_model=PromotionOut, status_code=status.HTTP_201_CREATED)
async def create_promotion(body: PromotionCreate, db: AsyncSession = Depends(get_session), _: User = Depends(require_owner)):
    try:
        await ProductService.get_or_404(db, body.product_id)
    except ProductNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Produk tidak ditemukan")
    try:
        promo = await PromotionService.create(
            db,
            product_id=body.product_id,
            discount_percentage=body.discount_percentage,
            start_date=body.start_date,
            end_date=body.end_date,
            status=body.status,
        )
        await db.commit()
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PromotionOverlapError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail={"code": "PROMOTION_OVERLAP", "message": "Promosi aktif lain untuk produk sama tumpang tindih."})
    data = PromotionOut.model_validate(promo)
    data.status = PromotionService.effective_status(promo)
    return data


@router.patch("/{promotion_id}", response_model=PromotionOut)
async def update_promotion(promotion_id: str, body: PromotionUpdate, db: AsyncSession = Depends(get_session), _: User = Depends(require_owner)):
    promo = await db.get(Promotion, promotion_id)
    if not promo:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Promosi tidak ditemukan")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(promo, k, v)
    try:
        if promo.status == "ACTIVE":
            await PromotionService.activate(db, promo)
        await db.commit()
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except PromotionOverlapError:
        raise HTTPException(status.HTTP_409_CONFLICT, detail={"code": "PROMOTION_OVERLAP", "message": "Promosi tumpang tindih."})
    data = PromotionOut.model_validate(promo)
    data.status = PromotionService.effective_status(promo)
    return data
