# AI-Native Store Management System

Capstone project — sistem manajemen toko **AI-native** dengan *conversational commerce*:
pelanggan memesan lewat **Web Chat Widget** dan **Bot Telegram**, sementara Owner mengelola
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
   Customer  ──▶    │  Bot Telegram (Bot API)  │──┤
                    └─────────────────────────┘  │
                                                 ▼
                                     ┌─────────────────────────┐
   Owner (Admin UI) ────────────────▶│  Nuxt Fullstack (satu    │
                                     │  origin :3000)          │
                                     │  /api/v1 (Nitro server) │
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

**Tech stack:** Nuxt 4 fullstack (Vue + Nitro server) · Drizzle ORM + Supabase PostgreSQL ·
Telegram Bot API · Groq/Qwen LLM. Backend Python lama sudah dihapus.

---

## 2. Struktur Repository

```
capstone/                     # Nuxt 4 FULLSTACK (satu-satunya aplikasi)
├── app/                       # Vue: pages admin + chat widget + stores
├── server/                    # Nitro API /api/v1
│   ├── api/v1/                 # endpoint REST (auth, products, orders, chat, ai-actions, webhooks…)
│   ├── utils/                  # auth (jose/bcryptjs), business, agents, llm, telegram, summary
│   └── database/               # schema Drizzle + migrations SQL
├── public/
├── drizzle.config.ts
├── nuxt.config.ts
├── package.json
├── .env.example               # satu-satunya env (FE + API)
└── docs/                      # desain teknis + log amendment
```

---

## 3. Requirement Software

| Tool | Versi | Untuk |
|---|---|---|
| Node.js | 20/22/24 | Aplikasi (FE + API satu origin) |
| npm | 10+ | Package manager |
| PostgreSQL | Supabase (session pooler :5432) | DB |

---

## 4. Setup Environment

Satu `.env` untuk FE + API (tanpa Python):

```bash
cp .env.example .env         # lalu isi nilai asli (JANGAN commit .env)
npm install
```

Isi minimal di `.env` (lihat `.env.example` untuk daftar lengkap):

| Variabel | Wajib | Catatan |
|---|---|---|
| `DATABASE_URL` | ya | Supabase **session pooler** port **5432** (`postgresql://…`, tanpa `+asyncpg`) |
| `JWT_SECRET_KEY` | ya (produksi) | min 32 char acak |
| `LLM_PROVIDER` | ya | `mock` untuk dev, `groq`/`openrouter`/`openai` untuk nyata |
| `GROQ_API_KEY` | bila `groq` | dari console.groq.com |
| `OPENROUTER_API_KEY` | bila `openrouter` | dari openrouter.ai/settings/keys |
| `TELEGRAM_PROVIDER` | ya | `mock` (dev) atau `bot` (Bot API asli) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` | bila `bot` | dari @BotFather / string acak |

> **Penting:** dev boleh `LLM_PROVIDER=mock` dan `TELEGRAM_PROVIDER=mock`.
> `NUXT_PUBLIC_API_BASE` default `/api/v1` (satu origin) — **jangan** menaruh
> secret di variabel `NUXT_PUBLIC_*` (masuk ke bundle browser).

---

## 5. Database

Skema sumber kebenaran: `server/database/schema.ts` (Drizzle).
Untuk Supabase yang sudah berisi tabel, tidak perlu migrasi — server memakai
UUID/timestamp client-side yang kompatibel.
Untuk database kosong baru:

```bash
# Opsi A — via drizzle-kit
npx drizzle-kit push

# Opsi B — SQL langsung (termasuk view stok + trigger audit append-only)
psql "$DATABASE_URL" -f server/database/migrations/0001_init.sql
```

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
DB target benar sebelum reset.** Seed tidak mengganti data toko yang sudah terisi.

Menuju final: [checklist](docs/FINALIZATION_CHECKLIST.md) ·
[runbook demo lokal](docs/DEMO_RUNBOOK.md).

---

## 6. Menjalankan Aplikasi

Satu perintah — FE + API satu origin (tanpa backend Python):

```bash
npm run dev                   # http://localhost:3000 (API: /api/v1, health: /health)
npm run build                 # produksi (node-server; dipakai Vercel via preset vercel)
```

### Deployment

- **Satu deploy** → aplikasi Nuxt (FE + `/api/v1` + `/health`) + Supabase managed.
- **Vercel**: deploy repo root; set env server (`DATABASE_URL`, `JWT_SECRET_KEY`,
  `LLM_PROVIDER=groq` + `GROQ_API_KEY`, `TELEGRAM_PROVIDER=bot` + token/secret)
  di Environment Variables Vercel. `NUXT_PUBLIC_API_BASE=/api/v1` (default).
- Webhook Telegram → `https://<domain>/api/v1/webhooks/telegram` dengan header
  `X-Telegram-Bot-Api-Secret-Token` = `TELEGRAM_WEBHOOK_SECRET`.

---

## 7. Testing

Verifikasi produksi + smoke E2E (tanpa Python):

```bash
npm run build                 # verifikasi build produksi (client + Nitro server)
node .output/server/index.mjs # jalankan build, lalu:
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/health
```

Alur yang sudah diverifikasi melawan Supabase + Groq nyata: login Owner,
katalog publik, Web Chat start → message (LLM) → order summary → confirm →
idempotency replay → cancel/restock, inventory/products/orders/promotions/
customers/conversations/audit/analytics, analyst ask, AI Action draft →
approve (EXECUTED) / reject.

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
| Webhook Telegram | `POST /webhooks/telegram` | secret token |
| Dev | `POST /dev/mock-tg` | hanya saat `DEBUG=true` |

Detail: [`docs/API_DESIGN.md`](docs/API_DESIGN.md).

**Konfirmasi order kanonik:** tombol/payload = `CONFIRM:<summary_ref>` (Web & Telegram).
Order hanya tercipta dari event konfirmasi eksplisit + idempotency key.

---

## 9. Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `DATABASE_URL belum diset` | `.env` belum ada / rebuild belum dilakukan | `cp .env.example .env`, isi, lalu `npm run build` ulang (env dibaca saat build) |
| `DB tetap tidak terjangkau` saat request | `DATABASE_URL` salah / transaction pooler | pakai Supabase **session pooler** port **5432**, bukan 6543 |
| Bot Telegram tidak membalas | webhook belum diset / tunnel mati | jalankan tunnel lalu `setWebhook` ulang (lihat `docs/TELEGRAM_SETUP.md`) |

---

## 10. Keamanan

- **Jangan pernah commit `.env`** — hanya `.env.example` (sudah di `.gitignore`).
- `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET_KEY`
  adalah secret backend — jangan kirim ke frontend.
- Webhook Telegram memverifikasi header `X-Telegram-Bot-Api-Secret-Token` (fail-closed
  tanpa secret terkonfigurasi) sebelum diproses.
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
| [`server/database/migrations/0001_init.sql`](server/database/migrations/0001_init.sql) | Skema + view stok + trigger audit |
