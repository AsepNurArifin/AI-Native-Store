from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.schemas.base import ORMBase


class AIActionOut(ORMBase):

    id: str
    action_type: str
    payload: dict[str, Any]
    status: str
    requested_by: str
    created_at: datetime
    decided_at: datetime | None
    executed_at: datetime | None
    result_target_id: str | None
    validation_failures: dict | None


class DraftRequest(BaseModel):
    instruction: str


class ApproveResponse(BaseModel):
    ai_action_id: str
    status: str
    result_target_id: str | None = None
    validation_failures: dict | None = None


class RejectRequest(BaseModel):
    note: str | None = None


class AuditLogOut(ORMBase):

    id: str
    ai_action_id: str | None
    event: str
    actor_type: str
    actor_id: str | None
    detail: dict[str, Any]
    timestamp: datetime
