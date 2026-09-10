from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.base import ORMBase


class UserOut(ORMBase):

    id: str
    name: str
    # str (bukan EmailStr): akun seed memakai domain .test (RFC reserved)
    # yang ditolak validator email — dan DB yang sudah ter-seed tak bisa dimigrasi
    # lewat seed ulang. Validasi format email tetap di sisi pendaftaran bila ada.
    email: str
    role: str
    status: str
    created_at: datetime


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
