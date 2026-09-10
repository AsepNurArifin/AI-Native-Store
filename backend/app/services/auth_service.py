from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, verify_password
from app.models import User
from app.schemas.auth import LoginResponse, UserOut


class InvalidCredentialsError(Exception):
    pass


class AuthService:
    @staticmethod
    async def login(db: AsyncSession, email: str, password: str) -> LoginResponse:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if not user or not verify_password(password, user.password_hash):
            raise InvalidCredentialsError()
        if user.status != "ACTIVE":
            raise InvalidCredentialsError()
        token = create_access_token(subject=str(user.id), role=user.role)
        return LoginResponse(
            access_token=token,
            user=UserOut.model_validate(user),
        )

    @staticmethod
    async def get_user(db: AsyncSession, user_id: str) -> User | None:
        return await db.get(User, user_id)
