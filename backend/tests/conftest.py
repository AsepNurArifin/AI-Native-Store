from typing import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

# Pastikan environment test: DB test terpisah (DATABASE_URL_TEST bila ada)
if settings.database_url_test:
    settings.database_url = settings.database_url_test

from app.db.session import AsyncSessionLocal, engine  # noqa: E402
from app.models import Base  # noqa: E402


@pytest_asyncio.fixture(autouse=True)
async def _prepare_db():
    """Per test: drop + create semua tabel (isolasi penuh, tanpa truncate/lock).

    Engine memakai NullPool di mode test, jadi tiap koneksi dibuat fresh
    di event loop yang sedang aktif — aman untuk loop function-scoped.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
