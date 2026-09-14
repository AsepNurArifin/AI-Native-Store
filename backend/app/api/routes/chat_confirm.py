import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models import Customer
from app.schemas.order import ConfirmOrderRequest, ConfirmOrderResponse
from app.services.conversation_service import ConversationService
from app.services.order_service import OrderError, OrderService
from app.services.summary_store import get as get_summary

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/{conversation_id}/confirm", response_model=ConfirmOrderResponse)
async def confirm_order(conversation_id: str, body: ConfirmOrderRequest, db: AsyncSession = Depends(get_session)):
    """UC-02 E5 — satu-satunya jalur pembuatan order (FR-SMS-06).
    Dipicu oleh event CONFIRM_ORDER (UI button / interactive reply) — BUKAN teks bebas.
    """
    conv = await ConversationService.get(db, conversation_id)
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Percakapan tidak ditemukan")

    customer = await db.get(Customer, conv.customer_id)
    if not customer:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Customer tidak ditemukan")

    summary = get_summary(body.order_summary_ref)
    if not summary:
        raise HTTPException(
            status.HTTP_410_GONE,
            detail={"code": "SUMMARY_EXPIRED", "message": "Ringkasan pesanan sudah kedaluwarsa. Ulangi pencarian produk."},
        )

    # identity channel-specific
    if conv.channel == "TELEGRAM":
        customer_identity = {"channel": "TELEGRAM", "identifier": customer.identifier, "name": customer.name, "contact": customer.contact}
    else:
        customer_identity = {
            "channel": "WEB",
            "identifier": body.customer.get("name", "guest") + "|" + (body.customer.get("contact") or "guest"),
            "name": body.customer.get("name") or "Tamu",
            "contact": body.customer.get("contact"),
        }

    try:
        order, replayed = await OrderService.create_from_summary(
            db,
            conversation_id=conversation_id,
            channel=conv.channel,
            customer_identity=customer_identity,
            items=[{"product_id": i.product_id, "quantity": i.quantity} for i in summary.items],
            idempotency_key=body.idempotency_key or str(uuid.uuid4()),
            fulfillment=body.fulfillment.model_dump(exclude_none=True) if body.fulfillment else None,
        )
    except OrderError as e:
        raise HTTPException(
            status.HTTP_409_CONFLICT if e.code in ("INSUFFICIENT_STOCK", "PRODUCT_INACTIVE", "EMPTY_ORDER") else status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": e.code, "message": e.message, **(e.details or {})},
        )

    await ConversationService.set_outcome(db, conversation_id, "ORDERED")
    await db.commit()
    return ConfirmOrderResponse(
        order_id=str(order.id),
        status=order.status,
        total=float(order.total_amount),
        items=[{"product_id": i.product_id, "quantity": i.quantity} for i in summary.items],
        replayed=replayed,
    )
