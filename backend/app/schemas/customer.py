from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.base import ORMBase


class CustomerOut(ORMBase):

    id: str
    channel: str
    identifier: str
    name: str
    contact: str | None
    registered_at: datetime


class CustomerDetail(CustomerOut):
    orders: list[dict] = []


class ConversationOut(ORMBase):

    id: str
    customer_id: str
    channel: str
    started_at: datetime
    last_activity_at: datetime
    ended_at: datetime | None
    outcome: str | None


class MessageOut(ORMBase):

    id: str
    sender: str
    content: str
    message_type: str
    timestamp: datetime


class RecommendationOut(ORMBase):

    id: str
    product_id: str
    reason: str
    timestamp: datetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut] = []
    recommendations: list[RecommendationOut] = []
