from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.base import ORMBase


class ProductSearchParams(BaseModel):
    """Shared validation for the owner API and LLM search tool (GB = decimal GB)."""

    model_config = ConfigDict(str_strip_whitespace=True, allow_inf_nan=False)

    query: str | None = Field(default=None, max_length=200)
    category: str | None = Field(default=None, max_length=50)
    budget_min: float | None = Field(default=None, ge=0)
    budget_max: float | None = Field(default=None, ge=0)
    ram_min_gb: int | None = Field(default=None, ge=1, le=4096)
    storage_min_gb: int | None = Field(default=None, ge=1, le=1_000_000)
    brand: str | None = Field(default=None, max_length=100)
    processor: str | None = Field(default=None, max_length=100)
    gpu: str | None = Field(default=None, max_length=100)
    stock_only: bool = False

    @model_validator(mode="after")
    def validate_budget(self):
        if self.budget_min is not None and self.budget_max is not None:
            if self.budget_min > self.budget_max:
                raise ValueError("budget_min tidak boleh melebihi budget_max")
        return self


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
