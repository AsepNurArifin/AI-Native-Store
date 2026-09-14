# ARCHITECTURE — Desain Arsitektur Sistem

> Menurunkan SRS v3.3 (§2, §5, §8) ke desain teknis konkret. Menjadi acuan implementasi F1–F7.

---

## 1. Gambaran Umum

```
                        ┌────────────────────────────────────────────┐
                        │                FRONTEND (Nuxt)             │
                        │  ┌────────────────┐  ┌───────────────────┐ │
                        │  │  Landing Page   │  │   Admin Panel     │ │
                        │  │  + Web Chat     │  │      (Owner)      │ │
                        │  │  Widget (guest) │  │   login JWT       │ │
                        │  └───────┬────────┘  └─────────┬─────────┘ │
                        └──────────┼─────────────────────┼───────────┘
                                   │ REST/JSON           │ REST/JSON + Bearer JWT
                                   ▼                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (FastAPI)                                │
│                                                                          │
│  ┌─────────────┐   ┌──────────────────────────────────────────────┐     │
│  │  Web Router  │   │            API Routers (internal)           │     │
│  │  (chat pub)  │   │  auth / products / inventory / orders /      │     │
│  └──────┬──────┘   │  promotions / conversations / analytics /     │     │
│         │          │  ai-actions / audit                            │     │
│         ▼          └──────────────────┬────────────────────────────┘     │
│  ┌────────────────────────────────────▼─────────────────────────────┐    │
│  │                     CHANNEL LAYER (Adapters)                     │    │
│  │  ┌──────────────────┐    ┌──────────────────────────────┐   │    │
│  │  │   Web Adapter     │    │  Telegram Adapter             │   │    │
│  │  │  (REST polling /  │    │  ┌────────────┐ ┌──────────┐  │   │    │
│  │  │   SSE / WS)       │    │  │ Provider:  │ │ Provider:│  │   │    │
│  │  │                   │    │  │ Mock       │ │ Bot API  │  │   │    │
│  │  └──────────────────┘    │  └────────────┘ └──────────┘  │   │    │
│  │                          │  │ PROVIDER=  │ │ PROVIDER=   │  │   │    │
│  │                          │  │ mock)      │ │ meta)       │  │   │    │
│  │                          │  └────────────┘ └─────────────┘  │   │    │
│  │                          └──────────────────────────────────┘   │    │
│  └───────────────────────────────────┬──────────────────────────────┘    │
│                                      ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                AI SALES AGENT CORE (channel-agnostic)             │   │
│  │   LLM session + tool calling (SRS §5.2)                           │   │
│  └───────────────────────────────────┬───────────────────────────────┘   │
│                                      ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                       SERVICE / DOMAIN LAYER                       │   │
│  │  OrderService · InventoryService · ProductService ·                │   │
│  │  PromotionService · ConversationService · AuditService ·           │   │
│  │  AiActionService · AnalyticsService                                │   │
│  │  (semua validasi bisnis + transaksi atomik ada di sini)            │   │
│  └───────────────────────────────────┬───────────────────────────────┘   │
│                                      ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │         REPOSITORY / ORM LAYER (SQLAlchemy async + psycopg)        │   │
│  └───────────────────────────────────┬───────────────────────────────┘   │
└──────────────────────────────────────┼────────────────────────────────────┘
                                       ▼
                          ┌──────────────────────────┐
                          │   SUPABASE (PostgreSQL)  │
                          │   managed, di luar       │
                          │   docker compose         │
                          └──────────────────────────┘
          (eksternal) LLM API ──────── hanya dipanggil backend
          (eksternal) Telegram Bot API ─ hanya dipanggil Telegram Adapter
```

Prinsip: **AI interprets; backend validates and executes** (PRD §50). Panah lintas layer selalu ke bawah; tidak ada shortcut (mis. router → ORM tanpa service, atau AI → ORM langsung).

---

## 2. Layer & Komponen Backend

### 2.1 `app/api/` — Router (thin)
- Hanya parsing request, auth dependency, memanggil service, membungkus response.
- Dua kelompok: **public** (web chat, webhook Telegram — tanpa JWT) dan **internal** (seluruhnya wajib JWT, FR-AUTH-02).

### 2.2 `app/channels/` — Channel Adapter Layer
Bertugas memenuhi BR-09 (channel independence) & SRS §2.5.

```
channels/
├── base.py              # format pesan internal (InboundMessage/OutboundMessage)
├── messaging_base.py    # routing bersama (dedupe, CONFIRM/CANCEL, SalesAgent)
└── telegram/
    ├── adapter.py       # normalisasi Update Telegram → format internal; inline keyboard
    ├── provider_bot.py  # implementasi Bot API asli (httpx)
    └── provider_mock.py # implementasi synthetic untuk dev/test
```

**Kontrak kunci:**
- `receive_channel_message(channel, payload)` → `InboundMessage{conversation_ref, customer_ref, text | button_id, timestamp}`
- `send_channel_message(channel, customer_ref, content, is_template)` → outbound
- `check_24h_window(customer_ref)` → bool (konsep window messaging; kini tak dipakai Telegram)

**Format internal pesan** harus identik dari semua channel — AI core tidak tahu bedanya. Tombol konfirmasi order dari Web (button UI) dan Telegram (inline keyboard) dinormalisasi menjadi event yang sama: `CONFIRM` dengan `summary_ref` (FR-SA-05). Payload kanonik: `CONFIRM:<summary_ref>`.

### 2.3 `app/ai/` — AI Layer (SELL / UNDERSTAND / ACT)
```
ai/
├── sales_agent.py       # orchestrasi LLM + tools untuk UC-01/02
├── analyst_agent.py     # UC-03
├── action_agent.py      # UC-04
├── tools/               # definisi tool/function calling (tabel §1.4 plan.md)
├── llm_client.py        # wrapper provider LLM (retry, timeout, logging)
└── prompts/             # teks prompt (lihat AI_PROMPTS.md)
```

Aturan keras (NFR-06):
- `ai/` **tidak boleh** import `app/models` atau SQLAlchemy — hanya memanggil tool.
- Tool adalah fungsi Python tipis yang memanggil **service layer** (otorisasi + validasi sama dengan jalur manual).
- `ai/tools/create_order` hanya boleh dieksekusi backend ketika event trigger-nya konfirmasi eksplisit dari channel layer — **bukan** keputusan LLM. LLM menyusun ringkasan; commit hanya dari event `CONFIRM`.

### 2.4 `app/services/` — Domain Layer (authority)
Semua business rule SRS §3 hidup di sini:
- `OrderService.create_from_summary()` — operasi atomik: validasi ulang stok+harga → insert Order + OrderItems → insert InventoryTransaction OUT → update Customer (jika baru) (FR-SMS-06). Pengecekan + pengurangan stok **satu transaksi DB** dengan row-level lock (concurrency TC-SMS-06c).
- `InventoryService.current_stock(product_id)` — selalu agregasi InventoryTransaction, tidak pernah kolom mutable (FR-SMS-02).
- `PromotionService` — status efektif on-read (BR 1) + guard no-overlap (BR 2).
- `AiActionService` — state machine AI Action (§8 SRS), validasi 4 kondisi (FR-AA-05), eksekusi lewat service target.
- `AuditService.log()` — satu-satunya jalur menulis AuditLog; append-only.

### 2.5 `app/models/` + `app/schemas/`
- Models = SQLAlchemy (skema di `DATA_SCHEMA.md`).
- Schemas = Pydantic untuk request/response (kontrak di `API_DESIGN.md`).

### 2.6 `app/seed/` — Synthetic Data Generator
- Generate: users (Owner), ~100–500 SKU produk elektronik (kategori: laptop, mouse, keyboard, monitor, headset — konteks contoh PRD), InventoryTransaction awal (IN MANUAL), customer, order historis untuk benchmark Business Analyst (NFR-09).
- Deterministik (seeded RNG) agar test reproducible.

---

## 3. Alur Data Kritis

### 3.1 UC-01/02 — Customer chat → rekomendasi → order (channel-agnostic)

```
[Web/WA] customer mengetik
   → ChannelAdapter.receive_channel_message()
   → ConversationService: ensure Conversation + insert ConversationMessage(CUSTOMER)
   → SalesAgent.handle(message, conversation_context)
       ├─ LLM call #1: interpret intent + ekstraksi (FR-SA-01)
       ├─ tool: search_products / compare_products / get_stock (FR-SA-02..04)
       │    → products + stok segar → Recommendation disimpan (reason grounded)
       ├─ LLM call #2: susun balasan (bahasa natural, hanya pakai data tool)
       └─ bila customer mau order → tool: build_order_summary(conversation_id)
            → harga & stok dibaca FRESH saat itu (FR-SA-05)
   → ConversationService: insert ConversationMessage(AI) + status outcome
   → ChannelAdapter.send_channel_message()
```

**Konfirmasi (jalur 1 — C2):**
```
customer menekan tombol [Konfirmasi Pesanan] (Web UI / WA interactive button)
   → event CONFIRM(summary_ref) + idempotency key
   → OrderService.create_from_summary()  ← ATOMIK: lock product rows,
      re-verify stock & price & ACTIVE, insert Order(CONFIRMED) + OrderItems,
      insert InventoryTransaction(OUT, OUT, ORDER)
   → sukses: kirim receipt; gagal stok: item dibatalkan + customer diberi tahu (UC-02 5a)
```

> LLM **tidak memegang kuasa commit**. Ia hanya memproduksi summary; commit adalah event UI → service.

### 3.2 UC-04 — AI Action draft → approval → eksekusi (jalur 2 — C2)

```
Owner mengetik instruksi di Admin Panel
   → ActionAgent: LLM ekstraksi → tool create_promotion_draft(params)
   → AiActionService.create_draft(): AIAction(DRAFT) + AuditLog(AI_SYSTEM, CREATED)
   → tampil di antrean approval Owner
Owner klik [Approve]
   → validasi role OWNER (FR-AA-03)
   → AiActionService.approve(): status APPROVED + Approval row + AuditLog(USER, APPROVED)
   → validasi 4 kondisi FR-AA-05:
       lolos → execute: Promotion(ACTIVE) dibuat + AuditLog(USER/AI_SYSTEM, EXECUTED)
       gagal → APPROVED_VALIDATION_FAILED + AuditLog(..., VALIDATION_FAILED) + approver diberi tahu
Owner klik [Reject]
   → status REJECTED + AuditLog(USER, REJECTED), tidak ada perubahan data operasional
```

### 3.3 UC-03 — Business Query

```
Owner mengetik pertanyaan (Admin Panel)
   → AnalystAgent: LLM interpret → pilih tool analyze_sales / analyze_inventory
   → service jalankan query agregasi → hasil terstruktur (angka final dari SQL, bukan LLM)
   → LLM hanya MENERJEMAHKAN hasil SQL ke kalimat natural (FR-BA-04 traceability:
     simpan query + hasil mentah sebagai lampiran jawaban di UI)
   → topik customer → wajib sertain disclaimer lintas-channel (FR-BA-05)
```

> Pola anti-halusinasi kunci: **angka tidak dihasilkan LLM — dihitung SQL.** LLM hanya merender narasi.

---

## 4. Desain Konkurensi & Integritas (NFR-04)

- **Stok & overselling (TC-SMS-06c):** `OrderService.create_from_summary()` membungkus semua dalam satu DB transaction; baris produk terkait di-lock (`SELECT ... FOR UPDATE`) sebelum cek `current_stock`. Dua order bersaing → satu commit, satu gagal → item dibatalkan (UC-02 5a).
- **Idempotency (UC-02 E5):** tabel `idempotency_keys(key, response_snapshot, expires_at)` — cek sebelum commit; double-klik tombol → response yang sama dikirim ulang tanpa order kedua.
- **Append-only AuditLog:** tanpa endpoint UPDATE/DELETE; (opsional) DB trigger yang menolak UPDATE/DELETE baris auditlog → memenuhi NFR-05 "percobaan ditolak".
- **InventoryTransaction:** tidak ada kolom `current_stock` mutable; agregasi selalu on-read (FR-SMS-02 formula).

---

## 5. Telegram Adapter — Detail

### 5.1 Webhook masuk (Telegram → backend)
- `POST /api/v1/webhooks/telegram` — Update (message/callback_query); wajib verifikasi header `X-Telegram-Bot-Api-Secret-Token` (fail-closed tanpa secret terkonfigurasi).
- Payload dinormalisasi ke `InboundMessage`; update non-pesan (edited, channel_post, dsb.) diabaikan. Dedupe `update_id`/`message_id` (in-memory MVP).

### 5.2 Keluar (backend → Bot API)
- `sendMessage` dengan `reply_markup` inline keyboard untuk konfirmasi order: `callback_data` = `CONFIRM:<summary_ref>` / `CANCEL`.
- Konfirmasi order idempoten via key stabil `tg:{summary_ref}` — retry webhook tidak mendobel order.

### 5.3 Mock Provider (synthetic dev)
- Endpoint dev-only `POST /api/v1/dev/mock-tg` untuk men-trigger inbound tanpa Bot API — memungkinkan UC-01/02 e2e test tanpa jaringan. **Wajib dinonaktifkan saat `APP_ENV=production`** (guard `DEBUG`).

### 5.4 Identitas customer Telegram
Chat id = `Customer.identifier` (channel=TELEGRAM), dibuat otomatis pada pesan pertama (FR-AUTH-03) — customer tidak pernah mengetik ulang kontaknya. Nama diambil dari `first_name` profil.

Setup bot lokal (BotFather, secret, tunnel): lihat `docs/TELEGRAM_SETUP.md`.

---

## 6. Frontend — Struktur (Nuxt)

```
frontend/app/
├── pages/
│   ├── index.vue                 # landing + Web Chat widget (guest)
│   ├── login.vue
│   └── admin/                    # guard: JWT + role
│       ├── index.vue             # dashboard ringkas
│       ├── products/             # list/form (CRUD + status)
│       ├── inventory/            # stok, transaksi, low-stock, adjustment
│       ├── orders/               # daftar + detail + cancel/complete
│       ├── promotions/           # daftar + detail status
│       ├── conversations/        # monitoring + filter channel
│       ├── analytics/            # chat Business Analyst
│       ├── actions/              # AI Action draft + antrean approval (Owner)
│       └── audit/                # AuditLog (Owner)
├── components/
│   ├── chat/ChatWidget.vue       # widget guest: bubble + list rekomendasi + tombol konfirmasi
│   └── ui/                       # tabel, badge status, dialog konfirmasi
├── composables/useApi.ts         # fetch wrapper (JWT, error format API_DESIGN.md)
└── stores/auth.ts                # Pinia: token, role, guard
```

Web Chat Widget:
- Guest session: `conversation_id` dari backend, disimpan di `localStorage` (session konteks tetap utuh — PRD §10.3).
- Tombol **[Konfirmasi Pesanan]** selalu dirender dari Order Summary aktif (bukan parsing teks).
- Nama + kontak diminta hanya saat konfirmasi pertama (FR-AUTH-03).

---

## 7. Docker (rencana container)

`docker-compose.yml` (root) — service:
1. `backend` — image `python:3.12-slim`; uvicorn `0.0.0.0:8000`; env dari `backend/.env` (`env_file`); healthcheck `GET /health`.
2. `frontend` — multi-stage `node:24-alpine`: install → `nuxt build` → serve (node server) port 3000; `NUXT_PUBLIC_API_BASE` via `build.args` (di-bake saat build).
3. Tidak ada service DB — Supabase managed via `DATABASE_URL`.

Dev workflow: backend bisa dijalankan langsung `uvicorn` (hot reload) tanpa Docker; Docker untuk parity environment (NFR-11: "berjalan dari container fresh, dependency minimal").

---

## 8. Cross-Cutting Concerns

| Kebutuhan | Desain |
|---|---|
| NFR-02 graceful degradation | Panggilan AI dibungkus circuit-breaker per agent; gagal → fallback message jelas ("maaf, layanan AI sedang bermasalah"), modul lain tetap hidup |
| NFR-12 channel isolation | Failure di WA adapter/webhook tidak boleh melempar exception ke path Web Chat — per-channel try/catch + log terpisah |
| Logging | Struktur JSON (request id, channel, conversation id) — untuk debugging AI & audit |
| Error handling | Format error konsisten (lihat API_DESIGN.md §Error); UC-01/02 E1–E7 punya mapping eksplisit |
| Rate/timeout | LLM timeout + retry (ENVIRONMENT.md); DB timeout → rollback penuh (UC-02 E2) |

---

## 9. Keputusan Desain yang Menunggu Konfirmasi Tim

| # | Keputusan | Status |
|---|---|---|
| D1 | Transport Web Chat: SSE vs WebSocket vs polling | ⬜ usulan: **SSE** (sederhana, cukup untuk chat satu arah server→client) |
| D2 | Verifikasi JWT: access-only vs access+refresh | ⬜ usulan: access token 60 menit + refresh 7 hari |
| D3 | Lock strategi stok: `SELECT FOR UPDATE` vs optimistic | ⬜ usulan: `FOR UPDATE` (lebih sederhana, beban rendah) |
| D4 | Trigger DB untuk append-only audit | ⬜ usulan: ya (defense-in-depth NFR-05) |
| D5 | Background job promotion expiry: cron di container vs Supabase pg_cron | ⬜ usulan: task scheduler sederhana di backend (APScheduler) |
