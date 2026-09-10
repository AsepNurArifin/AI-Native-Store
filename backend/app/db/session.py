from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings

# Mode test: NullPool agar tiap koneksi terikat ke event loop yang aktif saat itu
# (menghindari "Future attached to a different loop" lintas session pytest).
engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    poolclass=NullPool if settings.database_url_test else None,
    # Supabase pooler (transaction mode, port 6543) tidak mendukung
    # prepared statement asyncpg lintas checkout → matikan statement cache.
    # Aman juga untuk koneksi langsung/lokal; biaya performa diabaikan
    # pada skala capstone. Tanpa ini: DuplicatePreparedStatementError.
    connect_args={"statement_cache_size": 0},
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:  # FastAPI dependency
    async with AsyncSessionLocal() as session:
        yield session
