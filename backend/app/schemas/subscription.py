import re
from datetime import datetime

from pydantic import BaseModel, field_validator

from app.schemas.base import ORMBase

# WA Indonesia: +62/62/08/8 diikuti 7-13 digit (setelah normalisasi spasi/-)
_WA_RE = re.compile(r"^(\+62|62|0)?8\d{7,12}$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SubscriptionCreate(BaseModel):
    """Form subscribe dari landing (Fase 2). Validasi sama persis dengan FE
    (subscribe.vue) supaya UX error konsisten di kedua sisi."""

    store_name: str
    owner_name: str
    contact: str
    plan: str = "trial"

    @field_validator("store_name", "owner_name")
    @classmethod
    def _min_len(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("minimal 2 karakter")
        return v

    @field_validator("contact")
    @classmethod
    def _contact_format(cls, v: str) -> str:
        v = v.strip()
        norm = v.replace(" ", "").replace("-", "")
        if not (_EMAIL_RE.match(v) or _WA_RE.match(norm)):
            raise ValueError("harus berupa email atau nomor WhatsApp yang valid")
        return v

    @field_validator("plan")
    @classmethod
    def _plan_allowed(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("trial", "monthly", "yearly", "topup"):
            raise ValueError("paket tidak dikenal")
        return v


class SubscriptionOut(ORMBase):
    id: str
    store_name: str
    owner_name: str
    contact: str
    plan: str
    status: str
    created_at: datetime
