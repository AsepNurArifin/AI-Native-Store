"""Base untuk semua output schema (from_attributes).

Wildcard before-validator: kolom UUID Postgres (uuid.UUID) otomatis diubah ke str
sehingga field `id: str` di Pydantic v2 terisi benar (tanpa perlu StrUUID per field).
"""

import uuid

from pydantic import BaseModel, ConfigDict, field_validator


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @field_validator("*", mode="before")
    @classmethod
    def _uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v
