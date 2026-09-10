from pydantic import BaseModel


class PageResult(BaseModel):
    items: list
    page: int
    page_size: int
    total: int


class ApiError(BaseModel):
    code: str
    message: str
    details: dict | None = None
