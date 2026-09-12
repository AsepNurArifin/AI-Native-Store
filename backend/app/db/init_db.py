"""Inisialisasi DB: buat tabel (create_all) + seed pertama kali.

Catatan desain: Supabase adalah Postgres terkelola — create_all cukup untuk capstone.
Produksi penuh: gunakan Alembic migrations (D1 di DATA_SCHEMA §5).
"""

import asyncio
import logging

from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine
from app.models import Base

logger = logging.getLogger(__name__)

# Retry startup DB: postgres di docker compose bisa "healthy" lalu sempat restart
# sesaat saat init — tanpa retry, backend langsung exit (Application startup failed).
_STARTUP_RETRIES = 10
_STARTUP_BACKOFF_SECONDS = 3


async def init_db(seed: bool = True) -> None:
    for attempt in range(1, _STARTUP_RETRIES + 1):
        try:
            await _init_db_once(seed=seed)
            return
        except Exception as e:  # noqa: BLE001 — retry semua kegagalan koneksi startup
            if attempt == _STARTUP_RETRIES:
                logger.error(
                    "DB tetap tidak terjangkau setelah %d percobaan: %s\n"
                    "  -> Pastikan DATABASE_URL di backend/.env benar (Supabase session pooler),"
                    " atau jalankan profil local: docker compose -f docker-compose.yaml"
                    " -f docker-compose.local.yaml up -d",
                    _STARTUP_RETRIES, e,
                )
                raise
            logger.warning(
                "DB belum siap (percobaan %d/%d): %s — retry dalam %ds",
                attempt, _STARTUP_RETRIES, e, _STARTUP_BACKOFF_SECONDS,
            )
            await asyncio.sleep(_STARTUP_BACKOFF_SECONDS)


async def _init_db_once(seed: bool = True) -> None:
    async with engine.begin() as conn:
        # idempotency_keys pakai String PK — aman untuk create_all berulang
        await conn.run_sync(Base.metadata.create_all)
        # TRIGGER: AuditLog append-only (FR-AA-04) — buat/update defensif
        await conn.execute(text(
            """
            CREATE OR REPLACE FUNCTION prevent_audit_update_delete()
            RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'audit_logs is append-only (FR-AA-04)';
            END; $$ LANGUAGE plpgsql;
            """
        ))
        await conn.execute(text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_no_modify') THEN
                    CREATE TRIGGER trg_audit_no_modify
                    BEFORE UPDATE OR DELETE ON audit_logs
                    FOR EACH ROW EXECUTE FUNCTION prevent_audit_update_delete();
                END IF;
            END $$;
            """
        ))
        # v_product_stock: recreate dengan LOW_STOCK_THRESHOLD_DEFAULT dari config
        # (single source of truth = backend/.env; migrations/002 hanya skema awal).
        # Bind parameter tidak didukung asyncpg untuk DDL (CREATE VIEW), jadi nilai
        # di-interpolasi — aman karena pydantic memvalidasi field sebagai int.
        threshold = int(settings.low_stock_threshold_default)
        await conn.execute(text(f"""
            CREATE OR REPLACE VIEW v_product_stock AS
            SELECT
                p.id              AS product_id,
                p.name            AS name,
                p.category        AS category,
                p.status          AS status,
                COALESCE(SUM(
                    CASE it.movement WHEN 'IN' THEN it.quantity ELSE -it.quantity END
                ), 0)::BIGINT     AS current_stock,
                p.low_stock_threshold AS low_stock_threshold,
                (
                    COALESCE(SUM(
                        CASE it.movement WHEN 'IN' THEN it.quantity ELSE -it.quantity END
                    ), 0)::BIGINT <= COALESCE(p.low_stock_threshold, {threshold})
                )               AS is_low_stock
            FROM products p
            LEFT JOIN inventory_transactions it ON it.product_id = p.id
            GROUP BY p.id
        """))
    if seed:
        await _seed_if_empty()


async def _seed_if_empty() -> None:
    from app.db.session import AsyncSessionLocal
    from app.models import User

    async with AsyncSessionLocal() as db:
        from sqlalchemy import func, select

        count = (await db.execute(select(func.count(User.id)))).scalar_one()
        if count == 0:
            from app.seed.generate import generate_seed

            logger.info("DB kosong — generate synthetic seed...")
            await generate_seed(db)
            await db.commit()
            logger.info("Seed selesai.")
