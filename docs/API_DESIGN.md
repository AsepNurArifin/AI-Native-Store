# API_DESIGN — Kontrak REST API (Backend FastAPI)

> Kontrak BE↔FE berdasarkan SRS §3 (FR), §5.2 (tool layer, untuk endpoint yang diekspos), §7 (UC). Semua endpoint internal wajib JWT kecuali grup Public & Webhook. Basis path: `/api/v1`.

---

## 1. Konvensi Umum

- **Auth:** `Authorization: Bearer <JWT>`. Tanpa/invalid → `401` (FR-AUTH-01/02). Role tidak sesuai → `403` (FR-AUTH-04).
- **Format waktu:** ISO 8601 UTC (`2026-09-15T08:30:00Z`).
- **Uang:** integer rupiah (tanpa desimal) dalam JSON — `price: 9500000`.
- **Pagination:** `?page=1&page_size=20` → response `{ items, page, page_size, total }`.
- **Error format** (konsisten semua endpoint):
```json
{ "error": { "code": "INSUFFICIENT_STOCK", "message": "Stok produk X tersisa 0", "details": {} } }
```
Kode umum: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INSUFFICIENT_STOCK`, `PRODUCT_INACTIVE`, `PROMOTION_OVERLAP`, `OUTSIDE_24H_WINDOW`, `LLM_ERROR`, `IDEMPOTENT_REPLAY`.

---

## 2. Grup Endpoint

### 2.1 Public — Chat (Web Chat Widget, guest; FR-AUTH-03)

| Method | Path | Deskripsi |
|---|---|---|
| POST | `/api/v1/chat/sessions` | Mulai sesi → `{ conversation_id, customer_ref }` (customer WEB dibuat lazy) |
| POST | `/api/v1/chat/sessions/{id}/messages` | Kirim pesan customer → jalankan Sales Agent → response `{ reply, products?, order_summary? }` |
| GET | `/api/v1/chat/sessions/{id}/messages` | Riwayat sesi (reconnect widget) |
| POST | `/api/v1/chat/sessions/{id}/confirm` | **Konfirmasi eksplisit** (dari tombol UI). Body: `{ order_summary_ref, idempotency_key, customer: { name, contact } }` → hasil order atau failure item (UC-02) |
| GET | `/api/v1/chat/sessions/{id}/summary` | Order Summary aktif (harga/stok selalu fresh, FR-SA-05) |

> Chat update realtime: SSE `GET /api/v1/chat/sessions/{id}/stream` *(usulan D1 ARCHITECTURE.md — fallback: polling)*.

### 2.2 Webhook WhatsApp (public, verifikasi signature — ARCHITECTURE §5.1)

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/api/v1/webhooks/whatsapp` | Handshake verifikasi Meta (`hub.challenge`) |
| POST | `/api/v1/webhooks/whatsapp` | Event inbound (pesan/button/status) → proses async → `200` cepat |

### 2.3 Dev-only (nonaktif saat `APP_ENV=production`)

| Method | Path | Deskripsi |
|---|---|---|
| POST | `/api/v1/dev/mock-wa/simulate` | Simulasi inbound WA synthetic (Mock provider) |

### 2.4 Auth

| Method | Path | Deskripsi |
|---|---|---|
| POST | `/api/v1/auth/login` | `{ email, password }` → `{ access_token, user }` |
| POST | `/api/v1/auth/refresh` | Refresh token → access baru *(jika D2 access+refresh)* |
| GET | `/api/v1/auth/me` | Profil user + role |

### 2.5 Products (internal; Owner)

| Method | Path | FR | Deskripsi |
|---|---|---|---|
| GET | `/api/v1/products` | FR-SA-02 | List + filter status/kategori/q, budget_min/max, ram_min_gb, storage_min_gb, brand, processor, gpu, stock_only; stok dari agregasi transaksi |
| POST | `/api/v1/products` | | Create |
| GET | `/api/v1/products/{id}` | | Detail + current_stock |
| PATCH | `/api/v1/products/{id}` | | Update (atribut/harga/status ACTIVE↔INACTIVE) |
| DELETE | `/api/v1/products/{id}` | FR-SMS-01 | **Ditolak (409 PRODUCT_IN_USE)** bila direferensikan order_items/promotions/inventory_transactions → saran INACTIVE |

Filter produk pada implementasi aktif digabung AND; `q` mencari token pada
nama/kategori/spesifikasi, bukan parser kalimat penuh. RAM/storage minimum
numerik (GB; 1 TB = 1000 GB), budget pada harga dasar. Nilai spec hilang/rusak
tidak memenuhi minimum; `stock_only=true` disaring sebelum LIMIT. Response
list berupa `ProductOut[]` (maksimum internal 500), bukan envelope pagination.
Input invalid → 422. Lihat [`CATALOG_DATA_QUALITY.md`](CATALOG_DATA_QUALITY.md).

### 2.6 Inventory (internal)

| Method | Path | FR | Deskripsi |
|---|---|---|---|
| GET | `/api/v1/inventory/summary` | FR-SMS-03 | Semua produk + current_stock + flag low-stock |
| GET | `/api/v1/inventory/transactions` | | Riwayat (filter product, type, movement, periode) |
| POST | `/api/v1/inventory/adjustments` | | Stock adjustment manual → `{ product_id, movement, quantity, note }` → InventoryTransaction(MANUAL) |

### 2.7 Orders (internal)

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/api/v1/orders` | List + filter status/periode/channel_origin |
| GET | `/api/v1/orders/{id}` | Detail: items, customer, conversation ref, promo snapshot |
| POST | `/api/v1/orders/{id}/complete` | CONFIRMED → COMPLETED |
| POST | `/api/v1/orders/{id}/cancel` | CONFIRMED → CANCELLED (→ InventoryTransaction ADJUSTMENT/IN/CANCELLATION; COMPLETED ditolak 409) |

### 2.8 Promotions (internal)

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/api/v1/promotions` | List + status efektif on-read (BR 1) |
| POST | `/api/v1/promotions` | Buat manual (validasi sama FR-AA-05; jalur manual — bukan AI draft) |
| PATCH | `/api/v1/promotions/{id}` | Update (DRAFT) / aktifkan (guard overlap BR 2) |

### 2.9 Customers & Conversations (internal; FR-SMS-04a, 07–09)

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/api/v1/customers` | List per-channel (tanpa unifikasi — BR-10) |
| GET | `/api/v1/customers/{id}` | Detail + histori order |
| GET | `/api/v1/conversations` | List + **filter channel** (FR-SMS-08) + outcome |
| GET | `/api/v1/conversations/{id}` | Metadata + seluruh messages kronologis + recommendations (FR-SMS-09) |

### 2.10 Analytics — AI Business Analyst (internal; Owner; UC-03)

| Method | Path | Deskripsi |
|---|---|---|
| POST | `/api/v1/chat/analyst/ask` | **Owner only (JWT — FR-AUTH-02, Fix 1.3)** `{ question }` → `{ answer, data: {...}, query_used, disclaimer? }` — angka dari SQL; disclaimer lintas-channel bila jawaban memakai data channel_distribution (FR-BA-05) |

### 2.11 AI Actions (internal; UC-04)

| Method | Path | Deskripsi |
|---|---|---|
| POST | `/api/v1/ai-actions/draft` | **Owner only** `{ instruction }` (natural language) → ActionAssistant → AIAction status DRAFT (FR-AA-01/02; Fix 1.2). Instruksi tak bisa dipahami → 422 dengan pesan ramah |
| GET | `/api/v1/ai-actions` | List + filter status |
| GET | `/api/v1/ai-actions/{id}` | Detail draft + audit trail |
| POST | `/api/v1/ai-actions/{id}/approve` | **Owner only** (403 untuk non-Owner — FR-AA-03) → validasi 4 kondisi (FR-AA-05) → EXECUTED atau APPROVED_VALIDATION_FAILED (+alasan) |
| POST | `/api/v1/ai-actions/{id}/reject` | Owner only → REJECTED (+note opsional) |

### 2.12 Audit Logs (internal; Owner)

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/api/v1/audit-logs` | List + filter (ai_action_id, event, actor_type) — **tidak ada PUT/DELETE** (NFR-05) |

### 2.13 Health

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/health` | Liveness: `{ status, db: ok|fail, llm: ok|fail, wa_provider: mock|meta }` (tanpa auth) |

---

## 3. Contract Kunci (skema response penting)

### 3.1 Chat reply (Sales Agent) — `POST /chat/sessions/{id}/messages`
```json
{
  "reply": "Saya menemukan 2 laptop yang cocok...",
  "products": [
    { "product_id": "...", "name": "Laptop A", "price": 9500000,
      "specification": { "ram": "16GB", "storage": "512GB" },
      "current_stock": 5 }
  ],
  "order_summary": null
}
```
`products[].current_stock` selalu hasil query saat response dibuat (FR-SA-02).

### 3.2 Order Summary — `order_summary` object
```json
{
  "summary_ref": "sum_abc123",
  "items": [
    { "product_id": "...", "name": "Laptop A", "quantity": 1,
      "unit_price": 9500000, "discount": 500000, "line_total": 9000000 }
  ],
  "total": 9000000,
  "expires_note": "harga & stok diverifikasi ulang saat konfirmasi"
}
```

### 3.3 Confirm order — `POST /chat/sessions/{id}/confirm`
```json
// request
{ "order_summary_ref": "sum_abc123", "idempotency_key": "uuid",
  "customer": { "name": "Budi", "contact": "081234567890" } }
// 201
{ "order_id": "...", "status": "CONFIRMED", "total": 9000000,
  "items": [ { "name": "Laptop A", "quantity": 1 } ] }
// 200 (replay idempotent — order sama, tanpa duplikasi)
// 409 INSUFFICIENT_STOCK / PRODUCT_INACTIVE → item diexclude + pesan jelas
```

### 3.4 AI Action draft — `POST /ai/actions/draft`
```json
// request: { "instruction": "Buat promo 15% untuk produk X sampai akhir bulan" }
// 201
{ "ai_action_id": "...", "status": "DRAFT",
  "action_type": "CREATE_PROMOTION",
  "payload": {
    "product_id": "...", "product_name": "Produk X",
    "discount_percentage": 15,
    "start_date": "2026-10-01T00:00:00Z", "end_date": "2026-10-31T23:59:59Z"
  } }
```

### 3.5 Analyst jawaban — `POST /chat/analyst/ask` (Owner, JWT)
```json
// request: { "question": "Produk apa yang paling banyak terjual bulan ini?" }
// 200
{ "answer": "Produk X terjual 45 unit bulan ini.",
  "data": { "top_products": [ { "product_id": "...", "name": "Produk X", "units_sold": 45 } ] },
  "query_used": "analyze_sales",
  "disclaimer": "Dihasilkan AI berdasarkan data toko. Angka dapat berbeda dari laporan resmi." }
// topik distribusi channel → disclaimer: "Disclaimer lintas channel: angka WhatsApp dapat lebih rendah dari aktual ..."
```

---

## 4. Mapping Endpoint → FR/TC

| Endpoint | FR | TC |
|---|---|---|
| `/auth/*` | FR-AUTH-01/02/04 | TC-AUTH-01/02/04 |
| `/chat/*` | FR-AUTH-03, FR-SA-01..06 | TC-AUTH-03, TC-SA-01..06 |
| `/chat/*/confirm` | FR-SA-05, FR-SMS-06 | TC-SA-05, TC-SMS-06a/b/c |
| `/webhooks/whatsapp` | FR-SA-07 | TC-SA-07, NFR-TC-12 |
| `/products/*` | FR-SMS-01 | TC-SMS-01 |
| `/inventory/*` | FR-SMS-02/03 | TC-SMS-02/03 |
| `/orders/*` | FR-SMS-06 | TC-SMS-06a/b/c |
| `/promotions/*` | FR-SMS-05 | TC-SMS-05a/b |
| `/customers`, `/conversations/*` | FR-SMS-04a/07/08/09 | TC-SMS-04/07/08/09 |
| `/chat/analyst/ask` | FR-BA-01/02/04/05 | TC-BA-01/02/04/05 |
| `/ai/actions/*` | FR-AA-01..05 | TC-AA-01..05 |
| `/audit-logs` | FR-AA-04 | TC-AA-04, NFR-TC-05 |

---

## 5. Keputusan API Menunggu Konfirmasi

| # | Keputusan | Usulan |
|---|---|---|
| A1 | Chat realtime: SSE vs polling | SSE |
| A2 | `/ai/actions/draft` menerima instruksi bebas vs pilihan action_type eksplisit | Instruksi bebas (sesuai UC-04) + validasi katalog PRD §25 |
| A3 | Manual CRUD promotion tetap disediakan selain jalur AI draft | Ya (Owner butuh jalur manual; validasi sama) |
| A4 | Versioning path `/api/v1` | Ya |
