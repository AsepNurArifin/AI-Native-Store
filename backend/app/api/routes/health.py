from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_session

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(db: AsyncSession = Depends(get_session)):
    """P4.3 / API_DESIGN §health — liveness + status komponen (tanpa secret).

    Diekspos di dua path (lihat main.py):
      - `/health`            → untuk docker healthcheck & ops
      - `/api/v1/health`     → untuk frontend admin (`request('/health')`)

    Bentuk response mengikuti docs/API_DESIGN.md:
      `{ status, db, llm, telegram_provider, env, scheduler }`

    - 200 `status=ok`       : app hidup dan DB terjangkau.
    - 503 `status=degraded` : app hidup tetapi DB tidak terjangkau.
    Tidak memuat token/key/DSN/kredensial apapun.
    """
    try:
        await db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:  # noqa: BLE001 — health tidak boleh melempar; laporkan status
        db_status = "fail"
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "service": "ai-native-store-backend",
                "db": db_status,
                "llm": settings.llm_provider,
                "telegram_provider": settings.telegram_provider,
                "env": settings.app_env,
                "scheduler": "off",
            },
        )

    scheduler = (
        "on"
        if settings.maintenance_interval_minutes > 0 and settings.app_env != "testing"
        else "off"
    )
    return {
        "status": "ok",
        "service": "ai-native-store-backend",
        "db": db_status,
        "llm": settings.llm_provider,
        "telegram_provider": settings.telegram_provider,
        "env": settings.app_env,
        "scheduler": scheduler,
    }
