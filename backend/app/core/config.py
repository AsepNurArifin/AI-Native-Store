# AI-Native Store Management System — backend (FastAPI)
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_name: str = "ai-store"
    app_env: str = "development"  # development | testing | production
    backend_base_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:3000"
    log_level: str = "INFO"
    debug: bool = True  # mengaktifkan /api/v1/dev/* (mock WA)
    seed_on_startup: bool = True
    store_name: str = "Toko Demo"
    # Rate-limit (P5): aktif di server; pytest mematikannya via conftest
    # (test rate-limit mengaktifkannya kembali per-test).
    rate_limit_enabled: bool = True

    # Database (Supabase)
    database_url: str = "postgresql+asyncpg://store:store@localhost:5432/store"
    database_url_test: str = ""  # dipakai pytest bila diisi

    # Supabase — kredensial project (dashboard → Project Settings → API)
    # DATABASE_URL tetap yang dipakai backend untuk koneksi DB.
    # Key di bawah belum dipakai kode (frontend tidak konek langsung ke Supabase),
    # tapi disiapkan di sini supaya gaya setup sama seperti biasa.
    supabase_url: str = ""              # https://<project-ref>.supabase.co
    supabase_anon_key: str = ""         # public (publishable) key
    supabase_service_role_key: str = ""  # secret key — JANGAN pernah dikirim ke frontend

    # Auth
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Business defaults (SRS §11)
    low_stock_threshold_default: int = 5
    stockout_risk_days: int = 7
    max_discount_percent: int = 50
    idempotency_ttl_minutes: int = 30
    maintenance_interval_minutes: int = 5  # scheduler: expire promo + purge idempotency (BR 1, R5)

    # AI / LLM
    llm_provider: str = "mock"  # mock | openai | google | groq
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"  # OpenAI-compatible endpoint
    llm_model: str = "gpt-4o-mini"  # dipakai provider openai/google bila llm_model_sales kosong
    llm_model_sales: str = ""
    llm_model_analyst: str = ""
    llm_model_action: str = ""
    llm_temperature: float = 0.2  # P2 — determinisme (SRS §11)
    llm_timeout_seconds: int = 20
    llm_max_retries: int = 2
    llm_monthly_budget_idr: float = 0  # NFR-08 — untuk monitoring manual di startup/log

    # Groq (OpenAI-compatible; dipakai bila llm_provider="groq") — semua Qwen
    groq_api_key: str = ""
    groq_model_fast: str = "qwen/qwen3.8-27b"       # Sales Agent
    groq_model_reasoning: str = "qwen/qwen3.8-27b"  # Analyst + Action Assistant

    # Telegram (Fase 3 PLAN_PRODUCT_LAUNCH.md — bot self-service via BotFather,
    # tanpa verifikasi bisnis seperti WABA Meta)
    telegram_provider: str = "mock"  # mock | bot
    telegram_bot_token: str = ""  # dari @BotFather
    telegram_webhook_secret: str = ""  # secret_token setWebhook -> header X-Telegram-Bot-Api-Secret-Token
    telegram_api_base: str = "https://api.telegram.org"

    # Seed
    seed_owner_email: str = "owner@store.demo"
    seed_default_password: str = "ChangeMe123!"
    seed_sku_count: int = 100

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()


# Nilai default yang wajib diganti di production (P5 — security hardening)
_INSECURE_JWT_SECRETS = {"change-me", "change-me-64-char-random-secret"}


def validate_runtime_config() -> list[str]:
    """P5 — validasi konfigurasi saat startup (fail-fast untuk production).

    Return: daftar masalah. Panggil di lifespan:
      - app_env == production dan ada masalah  => RAISE (jangan start dengan config tidak aman)
      - selain itu                                => warning log saja (tidak blokir dev/test)

    Aturan tambahan (plan.md §4 B6 / §5 P5):
      - JWT secret lemah/default selalu dicatat, fatal di production;
      - DEBUG=true membuka /api/v1/dev/* (mock channel) — fatal di production;
      - SEED_ON_STARTUP=true di production bisa menulis data demo ke DB nyata — fatal;
      - LLM_PROVIDER=mock di production — fatal;
      - CORS wildcard di production — fatal.
    """
    problems: list[str] = []

    if (
        not settings.jwt_secret_key
        or len(settings.jwt_secret_key) < 32
        or settings.jwt_secret_key in _INSECURE_JWT_SECRETS
    ):
        problems.append("JWT_SECRET_KEY default/lemah — wajib ganti (min 32 char acak) di production")

    if settings.app_env == "production":
        if settings.debug:
            problems.append("DEBUG=true pada production (membuka /api/v1/dev/*)")
        if settings.seed_on_startup:
            problems.append("SEED_ON_STARTUP=true pada production (seed otomatis tidak boleh di DB nyata)")
        if settings.llm_provider == "mock":
            problems.append("LLM_PROVIDER=mock pada production (harus provider nyata: openai|google|groq)")
        if settings.telegram_provider == "mock":
            problems.append("TELEGRAM_PROVIDER=mock pada production (fallback demo — pastikan disadari tim)")
        if "*" in settings.cors_origin_list:
            problems.append("CORS_ORIGINS mengandung '*' pada production")
    elif settings.llm_provider != "mock" and not (settings.llm_api_key or settings.groq_api_key):
        problems.append("LLM_PROVIDER bukan mock tetapi API key kosong (LLM_API_KEY / GROQ_API_KEY)")

    return problems
