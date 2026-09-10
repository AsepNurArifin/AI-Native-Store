from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import ORMBase


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=50)
    specification: dict[str, Any] = Field(default_factory=dict)
    price: float = Field(ge=0)
    status: str = "ACTIVE"
    low_stock_threshold: int | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    specification: dict[str, Any] | None = None
    price: float | None = Field(default=None, ge=0)
    status: str | None = None
    low_stock_threshold: int | None = None


class ProductOut(ORMBase):

    id: str
    name: str
    category: str
    specification: dict[str, Any]
    price: float
    status: str
    low_stock_threshold: int | None
    current_stock: int = 0
    is_low_stock: bool = False


class PromotionCreate(BaseModel):
    product_id: str
    discount_percentage: float = Field(gt=0)
    start_date: datetime
    end_date: datetime
    status: str = "DRAFT"


class PromotionUpdate(BaseModel):
    discount_percentage: float | None = Field(default=None, gt=0)
    start_date: datetime | None = None
    end_date: datetime | None = None
    status: str | None = None


class PromotionOut(ORMBase):

    id: str
    product_id: str
    discount_percentage: float
    start_date: datetime
    end_date: datetime
    status: str  # effective status (on-read)
    created_at: datetime
