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

    # Database
    database_url: str = "postgresql+asyncpg://store:store@localhost:5432/store"
    database_url_test: str = ""  # dipakai pytest bila diisi

    # Auth
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Business defaults (SRS §11)
    low_stock_threshold_default: int = 5
    stockout_risk_days: int = 7
    max_discount_percent: int = 50
    idempotency_ttl_minutes: int = 30

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

    # Groq (OpenAI-compatible; dipakai bila llm_provider="groq") — semua Qwen
    groq_api_key: str = ""
    groq_model_fast: str = "qwen/qwen3.8-27b"       # Sales Agent
    groq_model_reasoning: str = "qwen/qwen3.8-27b"  # Analyst + Action Assistant

    # WhatsApp / WABA
    wa_provider: str = "mock"  # mock | meta
    wa_verify_token: str = "my-verify-token"
    wa_phone_number_id: str = ""
    wa_business_account_id: str = ""
    wa_access_token: str = ""
    wa_app_secret: str = ""
    wa_api_version: str = "v21.0"
    wa_test_numbers: str = ""
    wa_template_order_confirm: str = "order_confirmation"

    @property
    def wa_webhook_verify_token(self) -> str:
        return self.wa_verify_token

    @property
    def wa_template_name(self) -> str:
        return self.wa_template_order_confirm

    # Seed
    seed_owner_email: str = "owner@tokodemo.test"
    seed_staff_email: str = "staff@tokodemo.test"
    seed_default_password: str = "ChangeMe123!"
    seed_sku_count: int = 100

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def wa_test_number_list(self) -> list[str]:
        return [n.strip() for n in self.wa_test_numbers.split(",") if n.strip()]


settings = Settings()
