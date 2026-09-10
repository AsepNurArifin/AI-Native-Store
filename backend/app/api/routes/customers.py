from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_staff_or_owner
from app.db.session import get_session
from app.models import Customer, Order, User
from app.schemas.customer import CustomerDetail, CustomerOut

router = APIRouter(prefix="/customers", tags=["customers"], dependencies=[Depends(require_staff_or_owner)])


@router.get("", response_model=list[CustomerOut])
async def list_customers(db: AsyncSession = Depends(get_session), _: User = Depends(require_staff_or_owner)):
    rows = (await db.execute(select(Customer).order_by(Customer.registered_at.desc()).limit(200))).scalars().all()
    return list(rows)


@router.get("/{customer_id}", response_model=CustomerDetail)
async def get_customer(customer_id: str, db: AsyncSession = Depends(get_session), _: User = Depends(require_staff_or_owner)):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Customer tidak ditemukan")
    orders = (
        (await db.execute(select(Order).where(Order.customer_id == customer_id).order_by(Order.created_at.desc())))
        .scalars()
        .all()
    )
    data = CustomerDetail.model_validate(customer)
    data.orders = [{"id": str(o.id), "status": o.status, "total": float(o.total_amount), "created_at": o.created_at} for o in orders]
    return data
