# DATA_SCHEMA — Skema Database (Supabase / PostgreSQL)

> Turunan dari SRS §6.1 (entitas + atribut) dan §6.2 (aturan integritas). Menjadi acuan migration F1.
> Konvensi: snake_case; semua tabel PK `id UUID` (kecuali dinyatakan lain); timestamp `timestamptz` (UTC); enum via `VARCHAR + CHECK` (portabel, mudah dibaca di migration).

---

## 1. Ringkasan Entitas (13, tanpa Cart — C7)

```
users ──┐
        ├─▶ approvals ──▶ ai_actions ──▶ audit_logs
customers ──▶ conversations ──▶ conversation_messages
        │            └──▶ recommendations ──▶ products
        └──▶ orders ──▶ order_items ──▶ products
products ──▶ inventory_transactions
        └──▶ promotions
```

**Tidak ada tabel**: `cart`, `cart_items`, `payment` (SRS §6.1 catatan eksplisit).

---

## 2. Definisi Tabel

### 2.1 `users` — Staff/Owner internal (bukan customer)

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | UUID | PK, default gen_random_uuid() |
| `name` | VARCHAR(100) | NOT NULL |
| `email` | VARCHAR(255) | NOT NULL UNIQUE |
| `password_hash` | VARCHAR(255) | NOT NULL (bcrypt/argon2) |
| `role` | VARCHAR(10) | NOT NULL CHECK (role IN ('STAFF','OWNER')) |
| `status` | VARCHAR(10) | NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

### 2.2 `products`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | UUID | PK |
| `name` | VARCHAR(200) | NOT NULL, INDEX (trgm opsional untuk search) |
| `category` | VARCHAR(50) | NOT NULL, INDEX |
| `specification` | JSONB | NOT NULL DEFAULT '{}' — atribut bebas (ram, storage, processor, dll.) |
| `price` | NUMERIC(14,2) | NOT NULL CHECK (price >= 0) — IDR tanpa desimal terpakai, NUMERIC untuk aman |
| `status` | VARCHAR(10) | NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')) |
| `low_stock_threshold` | INTEGER | NULL — NULL = pakai default global (FR-SMS-03) |
| `created_at`, `updated_at` | TIMESTAMPTZ | NOT NULL |

> **`current_stock` BUKAN kolom** — selalu agregasi `inventory_transactions` (FR-SMS-02). View `v_product_stock` menyediakan `(product_id, current_stock, is_low_stock)` untuk kenyamanan read; view dihitung dari SUM movement.

### 2.3 `inventory_transactions` (append-only secara semantik)

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | UUID | PK |
| `product_id` | UUID | NOT NULL FK products(id) |
| `type` | VARCHAR(12) | NOT NULL CHECK (type IN ('IN','OUT','ADJUSTMENT')) — *penyebab* |
| `movement` | VARCHAR(3) | NOT NULL CHECK (movement IN ('IN','OUT')) — *arah efek* |
| `reference_type` | VARCHAR(12) | NOT NULL CHECK (reference_type IN ('MANUAL','ORDER','CANCELLATION')) |
| `quantity` | INTEGER | NOT NULL CHECK (quantity > 0) — selalu positif |
| `reference_id` | UUID | NULL — id order/koreksi terkait |
| `actor_id` | UUID | NULL FK users(id) — NULL bila sistem (order otomatis) |
| `timestamp` | TIMESTAMPTZ | NOT NULL DEFAULT now(), INDEX (product_id, timestamp) |

> Mapping event SRS: order confirm → (type=OUT, movement=OUT, reference_type=ORDER); cancel → (type=ADJUSTMENT, movement=IN, reference_type=CANCELLATION); restock manual → (type=IN, movement=IN, reference_type=MANUAL); koreksi turun → (type=ADJUSTMENT, movement=OUT, reference_type=MANUAL).
> Formula: `current_stock = SUM(qty movement=IN) − SUM(qty movement=OUT)` untuk semua type (FR-SMS-02).

### 2.4 `customers` (channel-specific — §2.6, BR-10)

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | UUID | PK |
| `channel` | VARCHAR(10) | NOT NULL CHECK (channel IN ('WEB','WHATSAPP')) |
| `identifier` | VARCHAR(150) | NOT NULL — WEB: `name|contact`; WHATSAPP: `+62...` |
| `name` | VARCHAR(100) | NOT NULL (WA: diisi nomor/label jika belum dikenal) |
| `contact` | VARCHAR(100) | NULL — WA selalu isi nomor; WEB diisi saat order |
| `registered_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| **UNIQUE** | | `(channel, identifier)` — profil ganda orang sama DIIZINKAN lintas channel (tidak ada FK penyatu) |

### 2.5 `promotions`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | UUID | PK |
| `product_id` | UUID | NOT NULL FK products(id) |
| `discount_percentage` | NUMERIC(5,2) | NOT NULL CHECK (> 0) |
| `start_date` | TIMESTAMPTZ | NOT NULL |
| `end_date` | TIMESTAMPTZ | NOT NULL CHECK (end_date > start_date) |
| `status` | VARCHAR(12) | NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','EXPIRED','REJECTED')) |
| `created_at` | TIMESTAMPTZ | NOT NULL |

> - Status **efektif** dihitung on-read: `status='ACTIVE' AND now() BETWEEN start_date AND end_date` (BR 1). Job async menandai EXPIRED (delayed marking boleh, tampilan ke customer tidak boleh salah).
> - Guard **no-overlap** (BR 2) ditegakkan service + optional exclusion constraint via `tstzrange` (lihat §5 D5).

### 2.6 `orders`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | UUID | PK |
| `customer_id` | UUID | NOT NULL FK customers(id) |
| `status` | VARCHAR(12) | NOT NULL CHECK (status IN ('DRAFT','CONFIRMED','COMPLETED','CANCELLED')) |
| `conversation_id` | UUID | NULL FK conversations(id) — traceability order→percakapan (PRD §16) |
| `channel_origin` | VARCHAR(10) | NOT NULL CHECK (channel_origin IN ('WEB','WHATSAPP')) |
| `total_amount` | NUMERIC(14,2) | NOT NULL DEFAULT 0 — dihitung saat commit |
| `promotion_snapshot` | JSONB | NULL — promosi aktif yang diterapkan saat order (traceability harga) |
| `created_at`, `completed_at`, `cancelled_at` | TIMESTAMPTZ | NULL sesuai status |

> DRAFT hanya status transien saat operasi atomik (SRS §8.1) — tidak pernah persisten lama.

### 2.7 `order_items`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | UUID | PK |
| `order_id` | UUID | NOT NULL FK orders(id) ON DELETE CASCADE |
| `product_id` | UUID | NOT NULL FK products(id) |
| `quantity` | INTEGER | NOT NULL CHECK (quantity > 0) |
| `price_at_order` | NUMERIC(14,2) | NOT NULL — snapshot harga, TERPISAH dari products.price (integritas §6.2) |
| `line_total` | NUMERIC(14,2) | NOT NULL — quantity × harga efektif (post-promo) |

### 2.8 `conversations`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | UUID | PK |
| `customer_id` | UUID | NOT NULL FK customers(id) |
| `channel` | VARCHAR(10) | NOT NULL CHECK (channel IN ('WEB','WHATSAPP')) — FR-SMS-08 |
| `started_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |
| `last_activity_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() — untuk 24h window WA |
| `ended_at` | TIMESTAMPTZ | NULL |
| `outcome` | VARCHAR(20) | NULL CHECK (outcome IN ('OPEN','ORDERED','NO_MATCH','ABANDONED','ERROR')) |

### 2.9 `conversation_messages`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | BIGINT IDENTITY | PK — urutan insert konsisten |
| `conversation_id` | UUID | NOT NULL FK conversations(id), INDEX |
| `sender` | VARCHAR(10) | NOT NULL CHECK (sender IN ('CUSTOMER','AI')) |
| `content` | TEXT | NOT NULL |
| `message_type` | VARCHAR(12) | NOT NULL DEFAULT 'TEXT' CHECK (IN ('TEXT','PRODUCT_CARD','ORDER_SUMMARY','BUTTON','SYSTEM')) |
| `raw_payload` | JSONB | NULL — payload asli channel (untuk debugging/audit) |
| `timestamp` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

> Rekonstruksi sesi = ORDER BY timestamp (id) (TC-SMS-07).

### 2.10 `recommendations`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | UUID | PK |
| `conversation_id` | UUID | NOT NULL FK conversations(id) |
| `product_id` | UUID | NOT NULL FK products(id) |
| `reason` | TEXT | NOT NULL — justifikasi grounded, merujuk field produk (FR-SA-04) |
| `timestamp` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

### 2.11 `ai_actions`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | UUID | PK |
| `action_type` | VARCHAR(30) | NOT NULL — MVP: `'CREATE_PROMOTION'`; katalog extensible (PRD §25) |
| `payload` | JSONB | NOT NULL — parameter structured (draft) |
| `status` | VARCHAR(28) | NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','REJECTED','APPROVED_VALIDATION_FAILED','EXECUTED')) |
| `requested_by` | UUID | NOT NULL FK users(id) — Staff/Owner yang memberi instruksi |
| `created_at`, `decided_at`, `executed_at` | TIMESTAMPTZ | NULL sesuai tahap |
| `result_target_id` | UUID | NULL — id Promotion hasil eksekusi (traceability) |

### 2.12 `approvals`

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | UUID | PK |
| `ai_action_id` | UUID | NOT NULL FK ai_actions(id) |
| `actor_id` | UUID | NOT NULL FK users(id) — **service wajib verifikasi role=OWNER** (FR-AA-03) |
| `decision` | VARCHAR(10) | NOT NULL CHECK (decision IN ('APPROVED','REJECTED')) |
| `note` | TEXT | NULL — alasan reject opsional (UC-04 E3) |
| `timestamp` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

### 2.13 `audit_logs` (append-only — NFR-05)

| Kolom | Tipe | Constraint |
|---|---|---|
| `id` | BIGINT IDENTITY | PK |
| `ai_action_id` | UUID | NULL FK ai_actions(id) |
| `event` | VARCHAR(20) | NOT NULL CHECK (event IN ('CREATED','APPROVED','REJECTED','VALIDATION_FAILED','EXECUTED')) |
| `actor_type` | VARCHAR(10) | NOT NULL CHECK (actor_type IN ('USER','AI_SYSTEM')) |
| `actor_id` | UUID | NULL FK users(id) — NULL bila actor_type='AI_SYSTEM' |
| `detail` | JSONB | NOT NULL — before/after + konteks |
| `timestamp` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

> Append-only ditegakkan: tidak ada endpoint mutasi + **trigger DB yang menolak UPDATE/DELETE** (keputusan D4 ARCHITECTURE.md).

### 2.14 `idempotency_keys` (UC-02 E5)

| Kolom | Tipe | Constraint |
|---|---|---|
| `key` | VARCHAR(64) | PK — UUID per sesi konfirmasi |
| `order_id` | UUID | NULL FK orders(id) — hasil commit pertama |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT now() |

---

## 3. Index & Query Utama

| Kebutuhan | Index/query |
|---|---|
| Stok per produk | `SELECT SUM(CASE movement WHEN 'IN' THEN quantity ELSE -quantity END) FROM inventory_transactions WHERE product_id = $1` — bungkus jadi view `v_product_stock` |
| Search produk AI | `products WHERE status='ACTIVE' AND (name ILIKE ... OR category = ...)` + join v_product_stock `current_stock > 0` (FR-SA-02) |
| Low-stock list | view di atas `WHERE current_stock <= COALESCE(low_stock_threshold, $default)` |
| Produk terlaris | `order_items JOIN orders ON status IN ('CONFIRMED','COMPLETED') GROUP BY product_id ORDER BY SUM(quantity) DESC` |
| Rata-rata penjualan 30 hari (FR-BA-02) | `SUM(quantity)/30.0` dari order_items 30 hari terakhir |
| Monitoring percakapan | `conversations ORDER BY last_activity_at DESC`, filter channel |
| Overlap promo | `promotions WHERE product_id=$1 AND status='ACTIVE' AND daterange overlap start/end` |

---

## 4. Migrasi & Seed (rencana)

- Tools: **SQL migration file berurutan** di `backend/migrations/` (up saja, tercatat di tabel `schema_migrations`) — supabase-friendly; Alembic opsional jika tim lebih nyaman ORM-driven. *(Keputusan final di F0 — lihat §5 D6.)*
- Urutan pembuatan: users → products → inventory_transactions → customers → conversations → conversation_messages → recommendations → orders → order_items → promotions → ai_actions → approvals → audit_logs → idempotency_keys → view.
- Seed (F1, `backend/seed/`): 1 Owner + 1 Staff; 100–500 SKU synthetic; InventoryTransaction IN MANUAL per SKU; customer + order historis deterministik (untuk benchmark FR-BA/NFR-09); 1–2 promotion contoh (satu ACTIVE, satu DRAFT).
- Seed **idempotent**: cek marker (mis. table seed_marker) supaya tidak dobel saat re-run.

---

## 5. Keputusan Skema Menunggu Konfirmasi

| # | Keputusan | Usulan |
|---|---|---|
| D1 | `specification` JSONB vs kolom terstruktur | JSONB (fleksibel multi-kategori, tetap queryable via GIN) |
| D2 | View `v_product_stock` vs kolom cached + trigger | View (selalu konsisten, beban rendah ≤500 SKU) |
| D3 | Overlap promo: service-only vs DB exclusion constraint (tstzrange) | Service + unit test (constraints range rawan edge case); DB constraint sebagai hardening opsional |
| D4 | Trigger append-only audit_logs | Ya |
| D5 | PK UUID vs BIGINT untuk tabel audit/message | UUID untuk entity, BIGINT IDENTITY untuk append-only high-volume |
| D6 | Migration tool: raw SQL vs Alembic | Raw SQL file (sederhana, transparan ke Supabase) |
