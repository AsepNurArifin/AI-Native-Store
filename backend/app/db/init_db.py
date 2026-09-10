"""Inisialisasi DB: buat tabel (create_all) + seed pertama kali.

Catatan desain: Supabase adalah Postgres terkelola — create_all cukup untuk capstone.
Produksi penuh: gunakan Alembic migrations (D1 di DATA_SCHEMA §5).
"""

import logging

from sqlalchemy import text

from app.db.session import engine
from app.models import Base

logger = logging.getLogger(__name__)


async def init_db(seed: bool = True) -> None:
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
