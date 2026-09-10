import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db.init_db import init_db

    logger.info("Initializing database...")
    await init_db(seed=settings.seed_on_startup)
    logger.info("Startup complete.")
    yield


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
