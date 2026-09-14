import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings

# R4/debuggability: tanpa ini, log aplikasi (INFO tool-call SalesAgent, dll.)
# tidak punya handler dan TIDAK pernah muncul di docker logs — hanya uvicorn
# access log yang terlihat. basicConfig dipanggil saat import app, sebelum lifespan.
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)


async def _maintenance_job() -> None:
    """BR 1 + R5 — expire promosi lewat end_date & purge idempotency key basi.

    Dipanggil scheduler periodik. Gagal sendiri tidak mematikan app
    (logging saja), karena operasi ini best-effort.
    """
    from app.db.session import AsyncSessionLocal
    from app.services.order_service import OrderService
    from app.services.promotion_service import PromotionService
    from app.services.summary_store import purge_expired

    try:
        async with AsyncSessionLocal() as db:
            n_promo = await PromotionService.expire_due(db)
            n_keys = await OrderService.purge_expired_idempotency_keys(db)
            await db.commit()
        purge_expired()  # bersihkan summary kedaluwarsa
        if n_promo or n_keys:
            logger.info("maintenance: %d promo expired, %d idempotency keys purged", n_promo, n_keys)
    except Exception:
        logger.exception("maintenance job gagal")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.config import validate_runtime_config
    from app.db.init_db import init_db

    # P5 — fail-fast pada production bila konfigurasi tidak aman.
    problems = validate_runtime_config()
    for p in problems:
        logger.error("CONFIG: %s", p)
    if problems and settings.app_env == "production":
        raise RuntimeError(
            "Startup dibatalkan — konfigurasi production tidak aman:\n - " + "\n - ".join(problems)
        )

    logger.info("Initializing database...")
    await init_db(seed=settings.seed_on_startup)
    logger.info("Startup complete.")

    # BR 1: job async EXPIRED promosi (FR-SMS-05) + purge idempotency (R5).
    # Tidak dijalankan saat pytest (env testing) supaya tidak mengganggu test.
    if settings.app_env != "testing" and settings.maintenance_interval_minutes > 0:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler

        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            _maintenance_job, "interval",
            minutes=settings.maintenance_interval_minutes,
            id="maintenance", coalesce=True, max_instances=1,
        )
        scheduler.start()
        app.state.maintenance_scheduler = scheduler
        logger.info("Maintenance scheduler started (every %d min)", settings.maintenance_interval_minutes)

    yield

    scheduler = getattr(app.state, "maintenance_scheduler", None)
    if scheduler is not None:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title="AI-Native Store Management System",
    version="0.1.0",
    description="Capstone: conversational commerce + AI-assisted store operations. "
    "API docs: /docs (Swagger). Waktu: WIB (UTC+7).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

# P4.3 — liveness di root (docker healthcheck & ops) memakai router health yang sama.
from app.api.routes import health as _health  # noqa: E402

app.include_router(_health.router)
