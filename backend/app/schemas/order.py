from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import ORMBase


class OrderItemOut(ORMBase):

    id: str
    product_id: str
    quantity: int
    price_at_order: float
    line_total: float


class OrderOut(ORMBase):

    id: str
    customer_id: str
    status: str
    conversation_id: str | None
    channel_origin: str
    total_amount: float
    promotion_snapshot: dict | None
    created_at: datetime
    completed_at: datetime | None
    cancelled_at: datetime | None
    items: list[OrderItemOut] = []
    fulfillment: dict | None = None


class FulfillmentInfo(BaseModel):
    """Pilihan pengambilan pesanan — dikirim UI WEB saat konfirmasi (UC-02 E5)."""

    method: Literal["PICKUP", "DELIVERY"]
    recipient: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None


class ConfirmOrderRequest(BaseModel):
    order_summary_ref: str
    idempotency_key: str
    customer: dict  # {name, contact} for WEB; ignored for WA
    fulfillment: FulfillmentInfo | None = None


class ConfirmOrderResponse(BaseModel):
    order_id: str
    status: str
    total: float
    items: list[dict]
    replayed: bool = False
