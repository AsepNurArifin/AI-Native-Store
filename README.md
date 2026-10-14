# AI-Native Store Management System

Capstone project — sistem manajemen toko **AI-native** dengan *conversational commerce*:
pelanggan memesan lewat **Web Chat Widget** dan **Bot Telegram**, sementara Owner mengelola
toko dengan bantuan tiga AI agent (Sales, Business Analyst, Action Assistant).

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
- **Dua jalur order resmi** — (a) web: checkout langsung `/checkout` → `POST /orders`;
  (b) conversational Telegram: Order Summary → `CONFIRM:<summary_ref>`.
  Chat web widget = tanya-jawab (QA), pembelian tetap lewat checkout.
- **Stok tidak pernah kolom mutable** — selalu `SUM(inventory_transactions)` (view `v_product_stock`),
  pengecekan & pengurangan atomik dengan lock baris (`FOR UPDATE`) anti-oversell.
- **Satu rumus harga** — semua perhitungan harga/diskon (katalog, chat, checkout, admin) melewati
  `shared/utils/pricing.ts`: `discount_per_unit = round2(price × pct / 100)`,
  `unit_effective = max(round2(price − discount_per_unit), 0)`, `line_total = round2(unit_effective × qty)`.
  `price_at_order` = harga efektif per unit (net).
- **Price lock** — order yang dikonfirmasi ditagih persis seperti total pada `OrderSummary` yang
  ditampilkan; bila harga/promo berubah di antaranya, order ditolak `409 PRICE_CHANGED`.
  Yang dibandingkan bukan hanya total, tapi juga `unit_price` + `discount_per_unit` — supaya
  perubahan komposisi harga yang kebetulan menghasilkan total sama tetap terdeteksi.
- **Idempotency key wajib** — `POST /orders` wajib menerima `idempotency_key` dari client (tanpa
  fallback random); retry dengan key sama = replay order lama, tidak dobel. Pada jalur konfirmasi
  chat/Telegram key **selalu** diturunkan server dari `summary_ref` (`chat:<ref>` / `tg:<ref>`) —
  client tidak boleh meng-override, kalau tidak FE yang mengirim key acak tiap retry akan
  membuat order dobel.
- **Payment state terpisah dari order state** — order lahir `status=CONFIRMED` +
  `payment_status=UNPAID` (stok di-reserve) → `PAID` (kasir konfirmasi) → `COMPLETED`.
  Order `UNPAID` yang lewat `ORDER_TTL_MINUTES` **otomatis dibatalkan dan stok dikembalikan**
  (lazy expiry di endpoint baca, aman untuk serverless tanpa cron).
  **Hanya order `PAID` yang dihitung sebagai pendapatan** di analitik.
- **Identitas customer web = session id server** — cookie httpOnly `shaf_sid`, bukan
  `${nama}|${kontak}` (yang menyatukan semua pembeli anonim ke satu baris `Tamu|guest`).
- **Guard produksi fail-closed** — `server/plugins/00-assert-production.ts` menolak boot bila
  JWT secret default, `DEBUG=true`, `SEED_ON_STARTUP=true`, atau LLM/Telegram provider `mock`.
- **AI tidak pernah mengakses DB langsung** — hanya lewat tool → service layer.
- **Mutasi data hanya lewat jalur manusia/konfirmasi** — LLM tidak boleh membuat order atau
  mengaktifkan promosi; approval wajib Owner.

**Tech stack:** Nuxt 4 fullstack (Vue + Nitro server) · Drizzle ORM + Supabase PostgreSQL ·
Telegram Bot API · Groq/Qwen LLM. Backend Python lama sudah dihapus.

---

## 2. Struktur Repository

```
capstone/                     # Nuxt 4 FULLSTACK (satu-satunya aplikasi)
├── app/                       # Vue: pages admin + chat widget + storefront
├── shared/
│   └── utils/pricing.ts        # modul harga kanonik (dipakai FE + server)
├── server/                    # Nitro API /api/v1
│   ├── api/v1/                 # endpoint REST (auth, catalog, products, orders, chat, ai-actions, webhooks…)
│   ├── routes/                 # /health, /robots.txt, /sitemap.xml
│   ├── utils/                  # auth (jose/bcryptjs), business, agents, llm, telegram, summary, config
│   └── database/               # schema Drizzle + migrations SQL (DDL sumber kebenaran)
├── public/
├── drizzle.config.ts
├── nuxt.config.ts
├── package.json
└── .env.example               # satu-satunya env (FE + API)
```

---

## 3. Requirement Software

| Tool | Versi | Untuk |
|---|---|---|
| Node.js | 20/22/24 | Aplikasi (FE + API satu origin) |
| npm | 10+ | Package manager |
| PostgreSQL | Supabase (transaction pooler :6543) | DB |

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
| `DATABASE_URL` | ya | Supabase **transaction pooler** port **6543** (`postgresql://…`, tanpa `+asyncpg`) |
| `JWT_SECRET_KEY` | ya (produksi) | min 32 char acak |
| `IDEMPOTENCY_TTL_MINUTES` | tidak | masa berlaku idempotency key (default 30 menit) |
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

DDL sumber kebenaran = **migrations SQL** (`server/database/migrations/`, dijalankan
berurutan); `server/database/schema.ts` hanya mirror Drizzle-nya.

```bash
psql "$DATABASE_URL" -f server/database/migrations/0001_init.sql            # tabel + view stok + trigger audit
psql "$DATABASE_URL" -f server/database/migrations/0002_product_image_url.sql
psql "$DATABASE_URL" -f server/database/migrations/0003_order_summaries.sql  # order_summaries (store ringkasan, TTL)
psql "$DATABASE_URL" -f server/database/migrations/0004_order_payment_state.sql  # payment_status/paid_at/expires_at
```

> **Tidak pakai `psql` (Windows tanpa client)?** Migrasi juga bisa dijalankan dari Node
> karena project sudah memakai driver `postgres`:
> ```bash
> node -e "const{readFileSync}=require('fs');const p=require('postgres')(process.env.DATABASE_URL,{max:1});(async()=>{await p.unsafe(readFileSync('server/database/migrations/0004_order_payment_state.sql','utf8'));await p.end();console.log('OK')})()"
> ```

Untuk Supabase yang sudah berisi tabel dari versi sebelumnya, jalankan hanya file
migrasi yang belum diterapkan. Jangan `drizzle-kit push` (bisa mengubah DDBB di
luar migrations).

### 5.3 Seed

Seed otomatis berjalan saat startup **jika tabel `users` kosong** dan
`SEED_ON_STARTUP=true` → 1 akun Owner demo + katalog demo **12 SKU** elektronik
(HP, Laptop, Tablet, Aksesoris) beserta stok awal. Tidak ada data historis,
order, pelanggan, atau promo buatan seed — semuanya terbentuk dari pemakaian nyata.
Seed tidak mengganti data toko yang sudah terisi.

**Kredensial demo (development):** lihat `SEED_OWNER_EMAIL` / `SEED_DEFAULT_PASSWORD`
di `.env` (default `owner@store.demo` / `ChangeMe123!`).
`SEED_ON_STARTUP` **wajib `false` di produksi** (dicek `assertProductionSafe`).

### 5.4 Koneksi DB di serverless — transaction pooler, bukan session pooler

`DATABASE_URL` **wajib** memakai Supabase **transaction pooler** port **6543**.

Kenapa session pooler (5432) tidak boleh dipakai dari Vercel: mode session
mengalokasikan satu backend Postgres khusus untuk tiap koneksi client, dan
Vercel **membekukan lambda di antara request**. Saat beku, timer `idle_timeout`
driver DB tidak jalan, jadi koneksi tidak pernah dilepas. Tiap cold start menambah
slot baru sampai batas 15, lalu **semua** request gagal dengan:

```
PostgresError: (EMAXCONNSESSION) max clients reached in session mode
               - max clients are limited to pool_size: 15
```

`/api/v1/health` balas `503 degraded`, `/catalog/*` balas `500`. Transaction pooler
melayani banyak client dengan sedikit backend, sehingga lambda yang beku tidak
mengunci slot apa pun.

Prasyarat yang sudah dipenuhi kodenya (`server/utils/db.ts`):
`prepare: false` (wajib untuk transaction pooler) dan tidak ada fitur session-level
(temporary table, `LISTEN`/`NOTIFY`, `SET` per-session). Advisory lock yang dipakai
seed adalah `pg_advisory_xact_lock` — scope-nya transaksi, aman di transaction pooler.

**Melepas slot yang sudah terlanjur macet** (kalau pernah salah pakai port 5432):

```sql
-- jalankan via SQL Editor Supabase, atau psql dari transaction pooler
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'postgres'
  AND application_name = 'Supavisor'
  AND state = 'idle'
  AND extract(epoch FROM (now() - state_change)) > 60;
```

Setelah itu periksa kembali: `SELECT count(*) FROM pg_stat_activity WHERE
application_name = 'Supavisor'` harus kembali kecil.

---

## 6. Menjalankan Aplikasi

Satu perintah — FE + API satu origin (tanpa backend Python):

```bash
npm run dev                   # http://localhost:3000 (API: /api/v1, health: /health)
npm run build                 # produksi (node-server; dipakai Vercel via preset vercel)
```

### Deployment

- **Satu deploy** → aplikasi Nuxt (FE + `/api/v1` + `/health`) + Supabase managed.
- **Vercel**: deploy repo root; set env di Environment Variables Vercel. **WAJIB
  pakai awalan `NUXT_`** — `NUXT_APP_ENV`, `NUXT_DEBUG`, `NUXT_SEED_ON_STARTUP`,
  `NUXT_DATABASE_URL`, `NUXT_SUPABASE_URL`, `NUXT_SUPABASE_SERVICE_ROLE_KEY`,
  `NUXT_JWT_SECRET_KEY`, `NUXT_LLM_PROVIDER=groq` + `NUXT_GROQ_API_KEY`,
  `NUXT_TELEGRAM_PROVIDER=bot` + `NUXT_TELEGRAM_BOT_TOKEN` +
  `NUXT_TELEGRAM_WEBHOOK_SECRET`, `NUXT_PUBLIC_SITE_URL`. Daftar lengkap ada di
  `.env.example`. `NUXT_PUBLIC_API_BASE=/api/v1` (default).
- Webhook Telegram → `https://<domain>/api/v1/webhooks/telegram` dengan header
  `X-Telegram-Bot-Api-Secret-Token` = `TELEGRAM_WEBHOOK_SECRET`
  (via `https://api.telegram.org/bot<token>/setWebhook`).
- Semua state penting (ringkasan order, dedup update Telegram, idempotency) ada
  di database — aman untuk lingkungan serverless tanpa state in-memory.
- **Region function mengikuti database.** `vercel.json` men-set
  `"regions": ["sin1"]` (Singapore) karena Supabase ada di `ap-southeast-1`.
  Tanpa ini, function Vercel jatuh ke region default (US East) dan tiap query DB
  bolak-balik antar benua — cukup untuk membuat semua aksi admin terasa lambat.

#### Latensi: kenapa aksi admin bisa terasa lambat

Waktu aksi admin = (jumlah query berurutan) × (RTT ke database). RTT ke
Supabase `ap-southeast-1` dari Indonesia ≈ 50-100ms, dan koneksi baru ke
transaction pooler butuh ±700ms lagi. Jadi yang dijaga adalah **jumlah round
trip**, bukan berat query-nya:

- `server/utils/db.ts` — `idle_timeout` 300 detik (bukan 20) supaya koneksi tidak
  dibuang saat admin diam >20 detik, lalu request berikutnya membayar koneksi
  baru.
- `server/utils/auth.ts` — `getCurrentUser` di-cache per token 60 detik,
  memotong 1 query di semua endpoint admin. Konsekuensi: perubahan status/role
  user baru terlihat maksimal 60 detik kemudian.
- `server/utils/products.ts` — hapus produk memakai CTE (beberapa `DELETE` dalam
  satu statement) dan agregat per order, bukan query per baris.
- Halaman admin memperbarui list dari balasan mutasi, tidak memuat ulang seluruh
  list setiap kali.

Untuk pengembangan lokal yang benar-benar cepat, pakai Postgres lokal
(Docker / `supabase start`) sebagai `DATABASE_URL` — tidak ada kode yang bisa
menghapus RTT jaringan ke Singapore.

#### Kenapa env Vercel harus berawalan `NUXT_`

Nitro hanya meng-override `runtimeConfig` dari environment variable berawalan
`nitro.envPrefix` (Nuxt menge-setnya ke `NUXT_`) **saat runtime**. Nama telanjang
(`DATABASE_URL`, `DEBUG`, `APP_ENV`, …) hanya terbaca kalau ada ketika `nuxt build`
berjalan — jadi nilai bake-nya ikut terpasang ke dalam `.output/server/`.

Konsekuensinya kalau pakai nama telanjang: mengubah env berarti **harus redeploy**,
Community plan membatasi jumlah build harian, dan preview build bisa memakai env
Production. Prefix `NUXT_` aman untuk kedua skenario. Nama `NUXT_PUBLIC_*` untuk
kunci yang memang harus masuk ke bundle browser.

Catatan: `serverConfig()` masih punya fallback `|| process.env.X` setelah
`useRuntimeConfig()`. Fallback itu berguna saat build, tapi karena `nuxt.config.ts`
selalu mengisi tiap kunci dengan nilai non-kosong, cabang `process.env` praktis
tidak pernah tersentuh saat runtime. Jangan andalkan dia — andalkan `NUXT_`.

---

## 7. Verifikasi

```bash
npm run build       # build produksi (client + Nitro server)
npm run lint        # ESLint (server + app + shared) — harus 0 error
npm run typecheck   # vue-tsc — menangkap undefined reference / typo import
npm run verify      # lint + typecheck (gate sebelum commit)
node .output/server/index.mjs # jalankan build, lalu:
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/catalog/search?sort=termurah
```

> **`npm run typecheck` wajib dijalankan.** `npm run build` **tidak** melakukan
> typecheck — variabel/import yang hilang hanya muncul saat runtime (mis. `ReferenceError`).
>
| Kode typecheck | Arti | Contoh |
>|---|---|---|
| `TS2304` / `TS2551` | **Berbahaya** — nama tidak ada, pasti crash saat runtime | `promotions is not defined` |
| `TS2532` / `TS18048` | Ketidakpastian `undefined` (pola `.returning()[0]` Drizzle) | `'x' is possibly 'undefined'` |
| `TS2322` / `TS2345` | Ketidakcocokan tipe (mis. variant Badge) | `string` bukan union variant |

> **Status saat ini: 0 error lint, 0 warning, 0 error typecheck.**
>
> Yang sudah ditangani (jangan dibalik):
> - `noUncheckedIndexedAccess: true` (default Nuxt) membuat setiap `rows[0]` bertipe
>   `T | undefined`. Gunakan helper `firstRow(rows, ctx)` dari `server/utils/errors.ts`
>   alih-alih `rows[0]` — ia melempar error eksplisit kalau query kosong, bukan
>   `Cannot read properties of undefined`.
> - `DbLike` (`server/utils/db.ts`) menerima **koneksi maupun `tx`**. Deklarasikan
>   lewat `ReturnType<typeof getDb>` — `NonNullable<typeof _db>` menghasilkan
>   `never` dan membuat semua pemanggilan service error.
> - `bcryptjs@2` itu CommonJS: **wajib default-import** lalu destructure.
>   Named import lolos typecheck tapi crash saat runtime.
> - `app/components/ui/**` ada di ignore ESLint: komponen hasil generate
>   `shadcn-vue add` (bisa ditimpa CLI, dan `class?: any` memang disengaja).
> - **XSS di chat:** `marked` v5+ tidak lagi menyaring URL, jadi
>   `[x](javascript:…)` jadi `href` hidup pada `v-html`. `app/components/chat/MarkdownText.vue`
>   memakai renderer kustom (`safeUrl`) yang menolak `javascript:` / `data:` /
>   `vbscript:` — termasuk yang disamarkan dengan tab/newline. Escape-HTML saja
>   **tidak** menutup ini.

Checklist smoke alur kritis: login Owner → katalog publik → chat start → message
(LLM) → order summary → confirm (price lock, idempotent replay saat retry) →
**cek `payment_status=UNPAID`** → **Mark Paid** → complete → cancel/restock →
produk/orders/promotions/inventory/customers/conversations/audit/analytics;
analyst ask (pastikan order UNPAID **tidak** masuk revenue); AI Action draft →
approve (EXECUTED) / reject. Plus: adjustment `quantity: -5` → 422 (bukan 500);
`idempotency_key` > 64 char → 422; hapus produk yang pernah muncul di chat → 409.

---

## 8. API

| Area | Endpoint (prefix `/api/v1`) | Auth |
|---|---|---|
| Auth | `POST /auth/login`, `GET /auth/me` | publik / JWT |
| Katalog | `GET /catalog/search`, `/catalog/products`, `/catalog/categories`, `/catalog/:id` | publik |
| Checkout web | `POST /orders` (`items`, `customer`, `idempotency_key` **wajib**) | publik |
| Order (manage) | `GET /orders`, `GET /orders/:id`, `POST /orders/:id/pay`, `POST /orders/:id/cancel`, `POST /orders/:id/complete` | Owner (JWT) |
| Chat / Sales | `POST /chat/start`, `POST /chat/:id/messages` (web QA), `POST /chat/:id/confirm` (konfirmasi ringkasan percakapan) | publik (customer) |
| Analyst | `POST /chat/analyst/ask` | Owner (JWT) |
| AI Action | `GET /ai-actions`, `GET /ai-actions/:id`, `POST /ai-actions/draft`, `…/approve`, `…/reject` | Owner (JWT) |
| Produk | `GET/POST /products`, `GET/PATCH/DELETE /products/:id` | Owner (JWT) |
| Inventory | `GET /inventory/summary`, `GET /inventory/transactions`, `POST /inventory/adjustments` | Owner (JWT) |
| Promosi | `GET/POST /promotions`, `PATCH /promotions/:id` | Owner (JWT) |
| Pelanggan | `GET /customers`, `GET /customers/:id` | Owner (JWT) |
| Percakapan | `GET /conversations`, `GET /conversations/:id` | Owner (JWT) |
| Audit | `GET /audit/logs` | Owner (JWT) |
| Upload gambar | `POST /uploads/images` | Owner (JWT) |
| Webhook Telegram | `POST /webhooks/telegram` | secret token |
| Dev | `POST /dev/mock-tg`, `POST /dev/seed` | hanya saat `DEBUG=true` |

**Konfirmasi order** — dua jalur resmi:

- **Web:** checkout langsung di `/checkout` → `POST /orders` (`idempotency_key` wajib).
  Chat web widget hanya tanya-jawab (QA) — pembelian tetap lewat checkout.
- **Telegram (conversational):** bot menampilkan isi + total Order Summary sebelum
  order dibuat → konfirmasi lewat tombol / teks `CONFIRM:<summary_ref>` (jalur Telegram).
  `POST /chat/:id/confirm` = padanan REST jalur conversational ini.

Order hanya tercipta dari konfirmasi eksplisit + idempotency key. Saat konfirmasi,
isi & total `OrderSummary` dikunci: perubahan harga/promo menghasilkan `409 PRICE_CHANGED`.

### Lifecycle order & pembayaran

`orders.status` dan `orders.payment_status` sengaja dipisah karena QRIS hanya
**simulasi** (merchant ID contoh, tidak ada payment gateway) — jadi "order dibuat"
tidak sama dengan "sudah dibayar".

```
konfirmasi (web / telegram)
   └─> status=CONFIRMED, payment_status=UNPAID, expires_at=now+ORDER_TTL_MINUTES
         stok DIKURANGI (atomik, FOR UPDATE) — ini "reserve", bukan pembayaran
         ├─ POST /orders/:id/pay       -> payment_status=PAID, paid_at=now   (kasir)
         ├─ POST /orders/:id/cancel    -> CANCELLED + stok KEMBALI
         ├─ lewat expires_at           -> CANCELLED + stok KEMBALI (otomatis)
         └─ POST /orders/:id/complete  -> COMPLETED  (butuh sudah PAID)
```

- **Expire lazy, bukan cron.** `expireStaleOrders()` dipanggil di awal `GET /orders`
  dan `GET /inventory/summary`. Aman di serverless (Vercel) tanpa Vercel Cron, dan
  idempoten. Order yang sudah dibayar tidak pernah disentuh.
- **Complete tanpa bayar ditolak** `409 NOT_PAID` — tidak ada jalan pintas
  mark-as-complete supaya analitik tidak menghitung revenue palsu.
- **Analitik hanya menghitung `PAID`** (`isCountableOrder`). Order UNPAID yang
  kedaluwarsa otomatis CANCELLED sebelum dihitung.
- `pay` idempoten: bayar ulang order yang sudah PAID tidak mengubah `paid_at`.

**Kode error order** (`data.detail.code`):

| Code | HTTP | Arti |
|---|---|---|
| `VALIDATION` | 422 | Input tidak valid (field wajib, format, range) |
| `IDEMPOTENCY_KEY_REQUIRED` | 422 | `idempotency_key` kosong di `POST /orders` |
| `INVALID_QTY` | 422 | Quantity bukan bilangan bulat positif |
| `PRODUCT_NOT_FOUND` | 422 | `product_id` tidak ada di katalog |
| `EMPTY_ORDER` | 409 | Tidak ada item untuk dipesan |
| `PRODUCT_INACTIVE` | 409 | Produk sudah nonaktif |
| `INSUFFICIENT_STOCK` | 409 | Stok kurang (`detail.available` = sisa stok) |
| `PRICE_CHANGED` | 409 | Harga/promo berubah sejak ringkasan dibuat (price lock) |
| `IN_PROGRESS` | 409 | Permintaan idempoten sama sedang diproses — retry nanti |
| `SUMMARY_EXPIRED` | 410 | `order_summary_ref` kedaluwarsa/tidak ada |
| `SUMMARY_MISMATCH` | 409 | Ringkasan bukan milik percakapan tersebut |
| `INVALID_STATE` | 409 | Transisi status order tidak sah (mis. cancel order COMPLETED) |
| `NOT_PAID` | 409 | `complete` order yang `payment_status` masih UNPAID |
| `ORDER_EXPIRED` | 409 | `pay` order yang lewat `ORDER_TTL_MINUTES` (belum di-expire) |
| `PROMO_OVERLAP` | 409 | Promo aktif overlap untuk produk yang sama |
| `PRODUCT_IN_USE` | 409 | Produk dipakai order — nonaktifkan, jangan hapus |

---

## 9. Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `DATABASE_URL belum diset` | `.env` belum ada / rebuild belum dilakukan | `cp .env.example .env`, isi, lalu `npm run build` ulang (env dibaca saat build) |
| Seluruh halaman & API balas `500` + header `X-Vercel-Error: FUNCTION_INVOCATION_FAILED` | plugin Nitro gagal boot — biasanya guard produksi menolak start | buka **Vercel → Logs**, cari `[config] GAGAL guard produksi:`; pesan itu mencantumkan seluruh env `NUXT_*` yang kurang. Set di Environment Variables (scope Production), lalu redeploy |
| `promotions is not defined` / `X is not defined` saat runtime | import hilang tapi build tetap hijau | `npm run typecheck` (atau `npm run verify`) |
| `DB tetap tidak terjangkau` saat request | `DATABASE_URL` salah / port bukan pooler | pakai Supabase **transaction pooler** port **6543** (lihat `.env.example`) |
| Semua request API `500`/`503` (`EMAXCONNSESSION`, `max clients reached in session mode`) | app memakai **session pooler :5432** + Vercel membekukan lambda, sehingga koneksi idle tidak pernah dilepas dan slot penuh di 15 | pindah `DATABASE_URL` ke **transaction pooler :6543**; lepas slot yang macet dengan `pg_terminate_backend()` (lihat §5.4) |
| Bot Telegram tidak membalas | webhook belum diset / tunnel mati | jalankan tunnel lalu `setWebhook` ulang (lihat §6 Deployment) |
| Konfirmasi chat ditolak `PRICE_CHANGED` | harga/promo berubah sejak ringkasan dibuat | desain begitu: ulangi pesanan untuk harga baru — 0 order tercipta, stok utuh |
| `SUMMARY_EXPIRED` saat konfirmasi | ringkasan > 30 menit (TTL `order_summaries`) | buat ringkasan baru lewat chat |
| Retry checkout membuat error | `idempotency_key` wajib | kirim ulang dengan **key yang sama** untuk replay, key baru untuk order baru |
| Server tidak mau boot setelah deploy | guard produksi menolak start | set `APP_ENV=production`, `JWT_SECRET_KEY` acak ≥32 char, `DEBUG=false`, `SEED_ON_STARTUP=false`, provider bukan `mock` — di Vercel pakai awalan `NUXT_` (lihat §6) |
| Telegram membalas `401` | `TELEGRAM_PROVIDER=mock` (webhook fail-closed) | pakai `POST /dev/mock-tg` untuk dev, atau set `bot` + `TELEGRAM_WEBHOOK_SECRET` |
| Login `429` | kena rate limit 5×/15 mnt per (IP+email) | tunggu 15 menit; counter direset otomatis setelah login sukses |
| `NOT_PAID` saat complete | order belum dikonfirmasi bayar | `POST /orders/:id/pay` dulu (atau tombol "Tandai Lunas" di admin) |
| Order UNPAID tidak ada di daftar | lazy expiry membatalkannya | buka `GET /orders` / `GET /inventory/summary`; order CANCELLED + stok kembali |

---

## 10. Keamanan

- **Jangan pernah commit `.env`** — hanya `.env.example` (sudah di `.gitignore`).
- **Guard produksi berjalan saat boot** (`server/plugins/00-assert-production.ts`) —
  menolak start bila `DATABASE_URL` kosong, `JWT_SECRET_KEY` masih default,
  `DEBUG=true`, `SEED_ON_STARTUP=true`, atau `LLM_PROVIDER`/`TELEGRAM_PROVIDER=mock`.
  Semua pelanggaran dikumpulkan dan dilaporkan **sekaligus** dalam satu pesan, jadi
  tidak perlu redeploy berulang hanya untuk menemukan env berikutnya yang kurang.
- **Deteksi produksi tidak lagi bergantung `NODE_ENV`.** `nuxt build` memaksa
  `NODE_ENV=production`, jadi memakainya sebagai fallback membuat build Vercel
  tanpa `APP_ENV` diam-diam menjadi mode production — guard menolak boot dan
  seluruh site balas `FUNCTION_INVOCATION_FAILED`. Sekarang: `APP_ENV` eksplisit,
  atau `VERCEL_ENV` untuk auto-deteksi (preview → `development`, production →
  `production`). Untuk lokal, `.env` dibiarkan `APP_ENV=development` supaya guard
  tidak menolak boot.
- **Env Vercel wajib berawalan `NUXT_`** — Nitro hanya meng-override `runtimeConfig`
  saat runtime lewat prefix tersebut; nama telanjang hanya ter-bake saat build.
  Detail di §6.
- **Webhook Telegram fail-closed** — tanpa `TELEGRAM_WEBHOOK_SECRET` (atau saat
  provider `mock`), `POST /webhooks/telegram` selalu `401`. Kalau `TELEGRAM_PROVIDER=bot`
  tapi token kosong, bot tidak bisa mengirim pesan dan webhook menolak semua update
  ( Intentional: fail-closed ). Simulasi tetap via `POST /dev/mock-tg` (DEBUG-gated).
- `audit_logs` bersifat **append-only** (ditegakkan trigger DB + service); aksi Owner
  atas produk/promo/stok/order ikut dicatat.
- `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET_KEY`
  adalah secret backend — jangan kirim ke frontend.
- Webhook Telegram memverifikasi header `X-Telegram-Bot-Api-Secret-Token` secara
  **fail-closed** (lihat di atas).
- `POST /auth/login` dibatasi **5 percobaan / 15 menit per (IP + email)**; counter
  direset setelah login berhasil.
- Identitas customer web berasal dari cookie httpOnly `shaf_sid` yang diterbitkan
  server — client tidak bisa memilih `identifier` sehingga tidak bisa sengaja
  menyatukan order dengan session orang lain.
- Endpoint `/api/v1/dev/*` hanya aktif saat `DEBUG=true` — wajib `false` di produksi.
- QRIS yang tampil di checkout adalah **simulasi** (payload EMV contoh) — pembayaran
  dikonfirmasi manual oleh kasir, bukan webhook payment gateway.
