from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.catalog import ProductOut


class ChatStartRequest(BaseModel):
    channel: str = "WEB"
    customer_ref: str | None = None  # WEB: "name|contact" (lazy); WA: phone from adapter


class ChatStartResponse(BaseModel):
    conversation_id: str
    customer_id: str
    channel: str


class ChatMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class OrderSummaryItem(BaseModel):
    product_id: str
    name: str
    quantity: int
    unit_price: float
    discount: float = 0
    line_total: float


class OrderSummary(BaseModel):
    summary_ref: str
    items: list[OrderSummaryItem]
    total: float


class ChatReply(BaseModel):
    reply: str
    products: list[ProductOut] = []
    order_summary: OrderSummary | None = None
    needs_customer_info: bool = False


class AnalystQueryRequest(BaseModel):
    question: str


class AnalystQueryResponse(BaseModel):
    answer: str
    data: dict[str, Any]
    query_used: str | None = None
    disclaimer: str | None = None
