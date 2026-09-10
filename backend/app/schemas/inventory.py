from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import ORMBase


class StockSummaryItem(BaseModel):
    product_id: str
    name: str
    category: str
    price: float
    current_stock: int
    low_stock_threshold: int | None
    is_low_stock: bool


class InventoryTransactionOut(ORMBase):

    id: str
    product_id: str
    type: str
    movement: str
    reference_type: str
    quantity: int
    reference_id: str | None
    actor_id: str | None
    timestamp: datetime


class AdjustmentCreate(BaseModel):
    product_id: str
    movement: str = Field(pattern="^(IN|OUT)$")  # direction of effect
    quantity: int = Field(gt=0)
    note: str | None = None
