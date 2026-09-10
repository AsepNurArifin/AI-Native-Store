from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings

# Supabase pakai pooler (pgbouncer). Pooler tidak mendukung prepared statement
# milik asyncpg, jadi statement cache-nya dimatikan.
# Kalau tidak dimatikan, akan muncul error: DuplicatePreparedStatementError.
# (Aman juga dipakai untuk Postgres lokal.)
connect_args = {"statement_cache_size": 0}

if settings.database_url_test:
    # Mode test (pytest).
    # Pakai NullPool supaya setiap koneksi dibuat baru di event loop yang sedang
    # aktif. Kalau tidak, bisa muncul error "Future attached to a different loop".
    engine = create_async_engine(
        settings.database_url_test,
        echo=False,
        poolclass=NullPool,
        connect_args=connect_args,
    )
else:
    # Mode biasa (development / production).
    # pool_pre_ping: cek dulu koneksi masih hidup sebelum dipakai,
    # supaya koneksi yang sudah putus otomatis dibuang.
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        pool_pre_ping=True,
        connect_args=connect_args,
    )

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:
    """Dependency FastAPI: buka session DB untuk satu request, lalu tutup otomatis."""
    async with AsyncSessionLocal() as session:
        yield session
