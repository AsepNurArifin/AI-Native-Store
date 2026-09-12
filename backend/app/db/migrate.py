"""Migration runner — AI-Native Store Management System (B4, DATA_SCHEMA.md §4).

Menjalankan file SQL berurutan di `backend/migrations/` (up-only),
tercatat di tabel `schema_migrations`. Aman dijalankan ulang (idempotent).

Kenapa asyncpg langsung (bukan SQLAlchemy text()):
  SQLAlchemy async + asyncpg memakai extended protocol yang TIDAK mendukung
  banyak statement dalam satu execute. asyncpg `conn.execute()` memakai
  simple protocol sehingga file migration multi-statement aman.

Usage:
    uv run python -m app.db.migrate              # apply pending migrations
    uv run python -m app.db.migrate --status     # daftar applied/pending
    uv run python -m app.db.migrate --url <dsn>  # pakai DSN lain (default: settings.database_url)
    uv run python -m app.db.migrate --baseline 001_initial_schema.sql
                                                 # tandai sudah-applied tanpa eksekusi
                                                 # (untuk DB yang dibuat via create_all)

Catatan:
  - Jangan dijalankan terhadap DB test pytest (conftest drop/create per test).
  - Dev/test lokal tetap memakai Base.metadata.create_all (app/db/init_db.py);
    file ini adalah jalur kanonik untuk produksi/Supabase.
  - DB yang dibuat via create_all LALU bermigrasi ke runner: baseline dulu file
    yang efeknya sudah ada (mis. 001), lalu apply sisanya. Jangan baseline 002
    di DB dev — index-nya belum dibuat oleh create_all, justru perlu di-apply.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import pathlib

import asyncpg
from sqlalchemy.engine import make_url

from app.core.config import settings

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

MIGRATIONS_DIR = pathlib.Path(__file__).resolve().parents[2] / "migrations"
DEFAULT_URL = settings.database_url


def _parse_dsn(dsn: str) -> dict:
    url = make_url(dsn)
    if url.drivername not in ("postgresql", "postgresql+asyncpg", "postgres"):
        raise SystemExit(f"Unsupported driver: {url.drivername} — pakai postgresql+asyncpg://")
    if not url.database:
        raise SystemExit("DATABASE_URL tidak lengkap (kurang database name).")
    return {
        "host": url.host,
        "port": url.port or 5432,
        "user": url.username,
        "password": url.password,
        "database": url.database,
    }


def _list_files() -> list[pathlib.Path]:
    return sorted(MIGRATIONS_DIR.glob("[0-9][0-9][0-9]_*.sql"))


async def _status(conn: asyncpg.Connection) -> None:
    applied_rows = await conn.fetch("SELECT name, applied_at FROM schema_migrations ORDER BY name")
    applied = {r["name"] for r in applied_rows}
    pending = [f.name for f in _list_files() if f.name not in applied]
    print("\n=== Migration status ===")
    if not applied_rows and not pending:
        print("(tidak ada migration)")
    for r in applied_rows:
        print(f"  [APPLIED ] {r['name']} @ {r['applied_at']}")
    for name in pending:
        print(f"  [PENDING ] {name}")
    print(f"  total: {len(applied_rows)} applied, {len(pending)} pending\n")


async def _apply_one(conn: asyncpg.Connection, filepath: pathlib.Path) -> None:
    name = filepath.name
    sql = filepath.read_text(encoding="utf-8")
    logger.info("Applying %s ...", name)
    async with conn.transaction():
        await conn.execute(sql)
        await conn.execute("INSERT INTO schema_migrations (name) VALUES ($1)", name)
    logger.info("Applied  %s", name)


async def _baseline(conn: asyncpg.Connection, names: list[str]) -> None:
    """Tandai migration 'sudah applied' TANPA mengeksekusi filenya.

    Untuk DB yang schema-nya dibuat lewat Base.metadata.create_all (jalur dev)
    lalu beralih ke runner migration: efek file sudah ada di DB, tinggal
    dicatat supaya runner tidak mencoba menjalankannya ulang.
    """
    known = {f.name for f in _list_files()}
    for name in names:
        if name not in known:
            raise SystemExit(
                f"Nama migration tidak dikenal: {name!r}\n"
                f"Yang tersedia: {', '.join(sorted(known))}"
            )
        await conn.execute(
            "INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
            name,
        )
        logger.info("Baselined %s (dicatat tanpa eksekusi)", name)


async def _run(dsn: str, only_status: bool, baseline: list[str] | None) -> None:
    conn = await asyncpg.connect(**_parse_dsn(dsn))
    try:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id         SERIAL PRIMARY KEY,
                name       VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMPTZ  NOT NULL DEFAULT now()
            )
            """
        )
        if baseline:
            await _baseline(conn, baseline)
            await _status(conn)
            return
        if only_status:
            await _status(conn)
            return
        applied = {r["name"] for r in await conn.fetch("SELECT name FROM schema_migrations")}
        pending = [f for f in _list_files() if f.name not in applied]
        if not pending:
            logger.info("Tidak ada migration pending — schema sudah mutakhir.")
            await _status(conn)
            return
        for filepath in pending:
            await _apply_one(conn, filepath)
        await _status(conn)
    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply SQL migrations (backend/migrations).")
    parser.add_argument("--status", action="store_true", help="hanya tampilkan status")
    parser.add_argument("--url", default=DEFAULT_URL, help="DSN postgresql+asyncpg:// (default settings.database_url)")
    parser.add_argument(
        "--baseline",
        nargs="+",
        metavar="FILE",
        default=None,
        help="tandai FILE sudah-applied tanpa eksekusi (DB ex-create_all), lalu keluar",
    )
    args = parser.parse_args()
    asyncio.run(_run(args.url, only_status=args.status, baseline=args.baseline))


if __name__ == "__main__":
    main()
