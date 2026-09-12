# AI-Native Store Management System

Capstone project — sistem manajemen toko **AI-native** dengan *conversational commerce*:
pelanggan memesan lewat **Web Chat Widget** dan **WhatsApp**, sementara Owner mengelola
toko dengan bantuan tiga AI agent (Sales, Business Analyst, Action Assistant).

> **Baseline requirement (normatif):** [`SRS_v3.3_AI_Native_Store_Management_System.md`](SRS_v3.3_AI_Native_Store_Management_System.md)
> dan [`Product Requirements Document — AI-Native Store Management System.md`](Product%20Requirements%20Document%20—%20AI-Native%20Store%20Management%20System.md).
> Master plan eksekusi: [`plan.md`](plan.md). Indeks dokumen: [`docs/README.md`](docs/README.md).

---

## 1. Ringkasan Arsitektur

```
                    ┌─────────────────────────┐
   Customer  ──▶    │  Web Chat Widget (FE)   │──┐
                    └─────────────────────────┘  │
                    ┌─────────────────────────┐  │   HTTPS/JSON
   Customer  ──▶    │  WhatsApp (Meta Cloud)  │──┤
                    └─────────────────────────┘  │
                                                 ▼
                                     ┌─────────────────────────┐
   Owner (Admin UI) ────────────────▶│  FastAPI Backend        │
                                     │  /api/v1                │
                                     │  ┌───────────────────┐  │
                                     │  │ channel adapters  │  │
                                     │  │ AI agents + tools │  │
                                     │  │ service layer     │  │
                                     │  └───────────────────┘  │
                                     └───────────┬─────────────┘
                                                 ▼
                                     ┌─────────────────────────┐
                                     │  Supabase (PostgreSQL)  │
                                     │  stok = agregasi txn    │
                                     │  audit_logs append-only │
                                     └─────────────────────────┘
```

**Prinsip keras:**

- **Tanpa Cart/CartItem** — order dibuat langsung dari Order Summary saat konfirmasi eksplisit.
- **Stok tidak pernah kolom mutable** — selalu `SUM(inventory_transactions)` (view `v_product_stock`).
- **AI tidak pernah mengakses DB langsung** — hanya lewat tool → service layer.
- **Mutasi data hanya lewat jalur manusia/konfirmasi** — LLM tidak boleh membuat order atau
  mengaktifkan promosi; approval wajib Owner.

**Tech stack:** Nuxt 4 (frontend) · Python 3.12 + FastAPI (backend) · Supabase PostgreSQL ·
Meta WhatsApp Cloud API · Groq/Qwen LLM.

---

## 2. Struktur Repository

```
capstone/
├── backend/                 # FastAPI + SQLAlchemy async + AI agents
│   ├── app/
│   │   ├── api/routes/       # endpoint REST (auth, products, orders, chat, ai_actions, webhooks…)
│   │   ├── ai/               # sales_agent, analyst_agent, action_agent, tools, llm
│   │   ├── channels/         # whatsapp adapter + provider (mock | meta)
│   │   ├── core/             # config, security (JWT), validasi runtime
│   │   ├── db/               # session, init_db, migrate (runner SQL)
│   │   ├── models/           # ORM (sumber kebenaran skema)
│   │   ├── services/         # business rule (authority)
│   │   └── seed/             # synthetic seed (deterministik)
│   ├── migrations/           # SQL migration berurutan (produksi/Supabase)
│   ├── tests/                # pytest (unit + e2e via entry point publik)
│   ├── docker-compose.yaml   # compose BACKEND saja
│   └── docker-compose.local.yaml  # override: + Postgres lokal
├── frontend/                # Nuxt 4 admin dashboard + chat widget
└── docs/                    # desain teknis + log amendment
```

---

## 3. Requirement Software

| Tool | Versi | Untuk |
|---|---|---|
| Python | 3.12+ | Backend |
| [`uv`](https://docs.astral.sh/uv/) | terbaru | Package manager backend (direkomendasikan) |
| Node.js | 20/22/24 | Frontend |
| npm | 10+ | Frontend |
| Docker + Compose | terbaru | Menjalankan backend (opsional untuk dev) |
| PostgreSQL | 16 (docker) atau Supabase | DB |

---

## 4. Setup Environment

### 4.1 Backend

```bash
cd backend
cp .env.example .env         # lalu isi nilai asli (JANGAN commit .env)
uv sync                      # buat .venv + install dependency
```

Isi minimal di `backend/.env`:

| Variabel | Wajib | Catatan |
|---|---|---|
| `DATABASE_URL` | ya | Supabase **session pooler** port **5432** (`postgresql+asyncpg://…`) |
| `DATABASE_URL_TEST` | untuk test | Postgres test terpisah, bukan DB dev/prod |
| `JWT_SECRET_KEY` | ya (produksi) | min 32 char acak |
| `LLM_PROVIDER` | ya | `mock` untuk dev, `groq`/`openai`/`google` untuk nyata |
| `GROQ_API_KEY` | bila `groq` | dari console.groq.com |
| `WA_PROVIDER` | ya | `mock` (dev) atau `meta` (WABA) |

> **Penting:** dev/test boleh `LLM_PROVIDER=mock` dan `WA_PROVIDER=mock`.
> Untuk `APP_ENV=production`, config divalidasi saat startup — nilai tidak aman
> (JWT default, `DEBUG=true`, `SEED_ON_STARTUP=true`, `LLM_PROVIDER=mock`, CORS `*`)
> akan **menggagalkan startup** dengan pesan jelas.

### 4.2 Frontend

```bash
cd frontend
cp .env.example .env
npm ci                        # atau npm install
```

`NUXT_PUBLIC_API_BASE` (default `http://localhost:8000/api/v1`) adalah satu-satunya
variabel frontend — **jangan** menaruh secret di sini (masuk ke bundle browser).

---

## 5. Database

### 5.1 Dev lokal cepat (opsional, tanpa Supabase)

```bash
cd backend
docker compose -f docker-compose.yaml -f docker-compose.local.yaml up -d db
# DB lokal: localhost:5433 (store/store), backend otomatis pakai host `db`
```

### 5.2 Migration (produksi / Supabase)

```bash
cd backend
uv run python -m app.db.migrate            # apply semua migration pending
uv run python -m app.db.migrate --status   # lihat applied/pending
```

Migration = file SQL berurutan di [`backend/migrations/`](backend/migrations/README.md),
tercatat di tabel `schema_migrations` (idempotent). Saat dev/test, tabel juga dibuat
otomatis via `Base.metadata.create_all` (`app/db/init_db.py`).

### 5.3 Seed

Seed otomatis berjalan saat startup **jika tabel `users` kosong** dan
`SEED_ON_STARTUP=true` → data demo **"Toko Bu Ratna"**: Owner "Ratna Wulandari",
98 SKU elektronik dalam 7 kategori (Smartphone, Laptop, Tablet, Audio, Wearable,
Aksesori, Komputer & Gaming), spesifikasi dan **harga simulasi**, riwayat stok
30 hari, pelanggan contoh (WA/Telegram/WEB), 2 order, 1 promo aktif.
Random seed tetap (`42`); waktu historis relatif terhadap waktu seeding.
Saldo historis non-negatif dan transaksi ORDER memiliki rujukan pesanan.
Lihat [kualitas data katalog](docs/CATALOG_DATA_QUALITY.md) untuk batas audit spesifikasi.

**Kredensial demo (development):** lihat `SEED_OWNER_EMAIL` / `SEED_DEFAULT_PASSWORD`
di `.env` (default `owner@store.demo` / `ChangeMe123!`). **Backup dan pastikan
DB target benar sebelum reset:** `backend/scripts/reset_demo.sql` menghapus
seluruh data toko. Gunakan hanya pada DB demo atas persetujuan pemilik, lalu
re-seed (restart backend atau `uv run python -m app.seed.generate`).
Seed tidak mengganti data toko yang sudah terisi.

Menuju final: [checklist](docs/FINALIZATION_CHECKLIST.md) ·
[runbook demo lokal](docs/DEMO_RUNBOOK.md).

---

## 6. Menjalankan Aplikasi

### 6.1 Backend

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
# Swagger: http://localhost:8000/docs
# Health : http://localhost:8000/health
```

Via Docker (backend saja):

```bash
cd backend
docker compose up -d --build
curl http://localhost:8000/health
```

### 6.2 Frontend

```bash
cd frontend
npm run dev                   # http://localhost:3000
npm run build                 # produksi (dipakai Vercel)
```

### 6.3 Deployment

- **Backend** → Docker (`backend/docker-compose.yaml`) + Supabase managed.
- **Frontend** → **Vercel** (tanpa container). Set `NUXT_PUBLIC_API_BASE` di
  Environment Variables Vercel ke URL backend produksi.
- Pastikan `CORS_ORIGINS` backend memuat domain Vercel (mis. `https://app.vercel.app`).

---

## 7. Testing

### 7.1 Backend

Postgres test terpisah:

```bash
docker run -d --name ai-store-test-pg \
  -e POSTGRES_USER=store -e POSTGRES_PASSWORD=store -e POSTGRES_DB=store_test \
  -p 5433:5432 postgres:16-alpine
# DATABASE_URL_TEST=postgresql+asyncpg://store:store@localhost:5433/store_test
```

Jalankan:

```bash
cd backend
uv run pytest -q                                   # seluruh suite
uv run pytest tests/test_flow_e2e.py -q            # alur end-to-end
uv run pytest tests/test_concurrency.py -q         # proteksi oversell
uv run pytest tests/test_webhook_security.py -q    # signature webhook Meta
```

`conftest.py` mengharuskan `DATABASE_URL_TEST` PostgreSQL lokal terpisah dengan
nama DB mengandung `test`, lalu drop/create tabel per test. URL kosong/nonlokal
atau identik dengan DB toko ditolak. Test menggunakan mock/scripted LLM, bukan
provider nyata. Suite finalisasi juga mencakup `test_seed.py`,
`test_product_search.py`, dan `test_electronics_e2e.py`.

### 7.2 Frontend

```bash
cd frontend
npm run build                 # verifikasi build produksi
```

---

## 8. API

| Area | Endpoint (prefix `/api/v1`) | Auth |
|---|---|---|
| Auth | `POST /auth/login`, `GET /auth/me` | publik / JWT |
| Produk | `/products/*` | Owner (JWT) |
| Inventory | `/inventory/*` | Owner (JWT) |
| Order | `/orders/*` | Owner (JWT) |
| Promosi | `/promotions/*` | Owner (JWT) |
| Chat / Sales | `POST /chat/sessions`, `…/messages`, `…/confirm` | publik (customer) |
| Analyst | `POST /chat/analyst/ask` | Owner (JWT) |
| AI Action | `POST /ai-actions/draft`, `…/approve`, `…/reject` | Owner (JWT) |
| Audit | `/audit-logs` | Owner (JWT) |
| Webhook WA | `GET/POST /webhooks/whatsapp` | verify token + HMAC |
| Dev | `POST /dev/mock-wa` | hanya saat `DEBUG=true` |

Detail: [`docs/API_DESIGN.md`](docs/API_DESIGN.md) · Swagger `/docs`.

**Konfirmasi order kanonik:** tombol/payload = `CONFIRM:<summary_ref>` (Web & WhatsApp).
Order hanya tercipta dari event konfirmasi eksplisit + idempotency key.

---

## 9. Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `ModuleNotFoundError: asyncpg` | dependency belum terinstall | `cd backend && uv sync` |
| `Expected a Python module at src/backend/__init__.py` | package marker hilang | pastikan `backend/src/backend/__init__.py` ada, lalu `uv sync` |
| `ModuleNotFoundError: app` saat pytest | `pythonpath` belum diset | jalankan pytest dari `backend/` (ada `pytest.ini`) |
| Test gagal di `_prepare_db` | Postgres test belum jalan | jalankan container `ai-store-test-pg` + buat `store_test` |
| `DB tetap tidak terjangkau` saat startup | `DATABASE_URL` salah / transaction pooler | pakai Supabase **session pooler** port **5432**, bukan 6543 |
| WA tidak membalas di luar 24 jam | aturan Meta | gunakan template (`WA_TEMPLATE_ORDER_CONFIRM`) |
| Startup produksi gagal + pesan CONFIG | guard keamanan | perbaiki nilai sesuai pesan (lihat §4.1) |

---

## 10. Keamanan

- **Jangan pernah commit `.env`** — hanya `.env.example` (sudah di `.gitignore`).
- `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `WA_ACCESS_TOKEN`, `JWT_SECRET_KEY`
  adalah secret backend — jangan kirim ke frontend.
- Webhook WhatsApp memverifikasi `X-Hub-Signature-256` (HMAC SHA256) untuk provider
  Meta sebelum diproses.
- `audit_logs` bersifat **append-only** (ditegakkan trigger DB + service).
- Endpoint `/api/v1/dev/*` hanya aktif saat `DEBUG=true` — wajib `false` di produksi.

---

## 11. Status & Dokumen Terkait

| Dokumen | Isi |
|---|---|
| [`plan.md`](plan.md) | Master plan: fase P0–P7, blocker, acceptance criteria |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Desain arsitektur & alur data |
| [`docs/DATA_SCHEMA.md`](docs/DATA_SCHEMA.md) | Skema DB + keputusan |
| [`docs/API_DESIGN.md`](docs/API_DESIGN.md) | Kontrak REST |
| [`docs/SRS_AMENDMENTS.md`](docs/SRS_AMENDMENTS.md) | Log deviasi + status ratifikasi |
| [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) | Daftar env variable |
| [`backend/migrations/README.md`](backend/migrations/README.md) | Panduan migration |
