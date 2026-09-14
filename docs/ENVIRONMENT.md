# ENVIRONMENT — Environment Variables & Secrets

> Daftar lengkap variabel environment yang dibutuhkan sistem. **Jangan pernah commit `.env`.** Gunakan `.env.example` sebagai template (dibuat saat implementasi F0).

## 1. Sumber & Format

- **Backend**: `backend/.env` (dibaca `app/core/config.py` via `env_file=".env"` saat dev lokal, dan oleh `docker compose` via `env_file: ./backend/.env`). Template: `backend/.env.example`.
- **Frontend**: `frontend/.env` — **hanya** variabel `NUXT_PUBLIC_*` (ikut ke bundle browser, jangan taruh secret). FE tidak di-docker — jalan lokal via `npm run dev`. Template: `frontend/.env.example`.
- **Docker (khusus BE)**: `cd backend && docker compose up -d` — DB = Supabase via `DATABASE_URL` di `.env`.
- **Pytest**: butuh Postgres lokal terpisah (conftest drop/create tabel per test — jangan arahkan ke Supabase). Jalankan container mandiri: `docker run -d --name ai-store-test-pg -e POSTGRES_USER=store -e POSTGRES_PASSWORD=store -e POSTGRES_DB=store -p 5432:5432 postgres:16-alpine` lalu `docker exec ai-store-test-pg psql -U store -d store -c "CREATE DATABASE store_test;"` (sekali saja).
- Tidak ada lagi `.env` di root — root hanya punya `.gitignore` sebagai jaring pengaman.
- Supabase tidak butuh env khusus selain connection string.
- Semua nilai di bawah adalah **contoh/placeholder** — nilai asli dari dashboard masing-masing provider.

## 2. Variabel Aplikasi (`APP_*`)

| Nama | Contoh | Keterangan |
|---|---|---|
| `APP_ENV` | `development` \| `production` | Mode runtime |
| `APP_NAME` | `ai-store` | Nama aplikasi (log/monitoring) |
| `BACKEND_PORT` | `8000` | Port uvicorn di container |
| `FRONTEND_PORT` | `3000` | Port Nuxt di container |
| `BACKEND_BASE_URL` | `http://localhost:8000` | Base URL publik API (untuk callback/webhook WA) |
| `FRONTEND_BASE_URL` | `http://localhost:3000` | Base URL web chat/landing |
| `CORS_ORIGINS` | `http://localhost:3000` | Origin yang diizinkan (koma-separated) |
| `LOW_STOCK_THRESHOLD_DEFAULT` | `5` | Ambang low-stock default (FR-SMS-03, dapat dioverride per produk). View `v_product_stock` otomatis disinkronkan dengan nilai ini saat startup |
| `STOCKOUT_RISK_DAYS` | `7` | Threshold stockout FR-BA-02 (default diusulkan SRS §11) |
| `MAX_DISCOUNT_PERCENT` | `50` | Batas diskon FR-AA-05 (default diusulkan SRS §11) |

## 3. Database — Supabase (`DATABASE_*`, `SUPABASE_*`)

| Nama | Contoh | Keterangan |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres` | Connection string utama (**wajib skema `+asyncpg://`** — backend pakai SQLAlchemy async). Ambil dari Supabase dashboard → Project Settings → Database. **Gunakan SESSION pooler (port 5432)** — transaction pooler (6543) tidak kompatibel dengan prepared statement asyncpg |
| `SUPABASE_URL` | `https://xyzcompany.supabase.co` | URL project (opsional, untuk util) |
| `SUPABASE_ANON_KEY` | `eyJ...` | Anon key (opsional; frontend tidak memakai Supabase langsung — semua lewat backend) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | ⚠️ Hanya jika benar-benar perlu admin API Supabase (mis. menjalankan SQL seed). Jangan pernah diekspos ke frontend |

> **Keputusan desain:** frontend **tidak** konek langsung ke Supabase. Semua akses data lewat backend FastAPI (SRS §2.1 — backend adalah source of truth; AI juga tidak boleh akses DB langsung, NFR-06).

## 4. Autentikasi (`AUTH_*` / `JWT_*`)

| Nama | Contoh | Keterangan |
|---|---|---|
| `JWT_SECRET_KEY` | *(random 64+ char)* | Secret untuk signing JWT — **wajib dirotasi antara dev & prod** |
| `JWT_ALGORITHM` | `HS256` | Algoritma signing |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Umur access token |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Umur refresh token (opsional, jika dipakai) |
| `SEED_OWNER_EMAIL` | `owner@store.demo` | Email akun Owner seed "Toko Bu Ratna" (dipakai oleh `app/seed/generate.py`) |
| `SEED_DEFAULT_PASSWORD` | *(ganti di prod)* | Password akun Owner seed — hanya untuk dev/demo; production guard menolak `SEED_ON_STARTUP=true` |

## 5. AI / LLM (`LLM_*`)

| Nama | Contoh | Keterangan |
|---|---|---|
| `LLM_PROVIDER` | `mock` \| `openai` \| `google` \| `groq` | Provider terpilih — **diputuskan: `groq`** (lihat catatan Groq di bawah). `mock` untuk dev offline |
| `LLM_API_KEY` | `sk-...` | API key jalur generik openai/google (tidak dipakai saat provider=groq) |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Endpoint OpenAI-compatible (hanya jalur openai; Groq memakai URL bawaan kode) |
| `LLM_MODEL` | `gpt-4o-mini` | Model generik jalur openai/google |
| `GROQ_API_KEY` | `gsk-...` | API key Groq (console.groq.com → API Keys) — wajib bila provider=groq |
| `GROQ_MODEL_FAST` | `qwen/qwen3.8-27b` | Model Sales Agent — **semua Qwen** (keputusan tim) |
| `GROQ_MODEL_REASONING` | `qwen/qwen3.8-27b` | Model Analyst + Action Assistant |
| `LLM_MODEL_SALES` | *(mis. `gpt-4o-mini`)* | Model untuk AI Sales Agent — pilih yang murah + cepat + tool-calling stabil (NFR-01, NFR-08) |
| `LLM_MODEL_ANALYST` | *(mis. `gpt-4o-mini`)* | Model untuk Business Analyst |
| `LLM_MODEL_ACTION` | *(mis. `gpt-4o-mini`)* | Model untuk Action Assistant |
| `LLM_TIMEOUT_SECONDS` | `20` | Timeout per call LLM |
| `LLM_MAX_RETRIES` | `2` | Retry saat LLM gagal (UC-01 E1) |
| `LLM_MONTHLY_BUDGET_IDR` | `300000` | Batas NFR-08 untuk monitoring |

## 6. Telegram (`TELEGRAM_*`)

| Nama | Contoh | Keterangan |
|---|---|---|
| `TELEGRAM_PROVIDER` | `mock` \| `bot` | `mock` = simulasi tanpa API nyata (dev/test), `bot` = Bot API asli (api.telegram.org). Default: `mock` |
| `TELEGRAM_BOT_TOKEN` | `123456:ABC-DEF...` | Token dari @BotFather — wajib bila `provider=bot` |
| `TELEGRAM_WEBHOOK_SECRET` | *(random string)* | Secret token setWebhook → diverifikasi dari header `X-Telegram-Bot-Api-Secret-Token` (fail-closed) |

> Detail langkah setup ada di [`TELEGRAM_SETUP.md`](TELEGRAM_SETUP.md).

## 7. Frontend (`frontend/.env` — public only)

| Nama | Contoh | Keterangan |
|---|---|---|
| `NUXT_PUBLIC_API_BASE` | `http://localhost:8000/api/v1` | Base URL API untuk browser. Di-bake saat build (`frontend/.env` untuk dev, `build.args` untuk Docker) |

## 8. Lain-lain

| Nama | Contoh | Keterangan |
|---|---|---|
| `LOG_LEVEL` | `INFO` | Level logging backend |
| `SEED_SKU_COUNT` | `100` | Jumlah SKU seed "Toko Bu Ratna" (dibatasi ukuran katalog ±96; max 500 per NFR-01) |
| `IDEMPOTENCY_TTL_MINUTES` | `30` | Umur idempotency key anti double-order (UC-02 E5) |

## 9. Matrix per Environment

| Variabel | Development | Testing (CI) | Production/Demo |
|---|---|---|---|
| `TELEGRAM_PROVIDER` | `mock` | `mock` | `bot` (atau `mock` bila bot belum disetup) |
| `DATABASE_URL` | Supabase project dev | Supabase project test / fresh DB | Supabase project prod/demo |
| `LLM_*` | API key dev | API key dev (atau mock LLM) | API key prod |
| `APP_ENV` | `development` | `testing` | `production` |
| `SEED_DEFAULT_PASSWORD` | bebas | bebas | **wajib diganti** |

## 10. Checklist Keamanan

- [ ] `backend/.env` & `frontend/.env` ada di `.gitignore` (plus `.gitignore` root sebagai jaring pengaman + `backend/.dockerignore` agar secret tidak masuk image)
- [ ] Tidak ada secret yang hardcode di source code
- [ ] `JWT_SECRET_KEY` berbeda antar environment
- [ ] `SUPABASE_SERVICE_ROLE_KEY` tidak pernah dikirim ke frontend
- [ ] Webhook Telegram memverifikasi `X-Telegram-Bot-Api-Secret-Token` dengan `TELEGRAM_WEBHOOK_SECRET` (fail-closed)
- [ ] `TELEGRAM_BOT_TOKEN` disimpan aman di `backend/.env` (tidak pernah dikirim ke frontend)
