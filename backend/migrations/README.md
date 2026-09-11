# Database Migrations — backend/migrations/

Migration SQL berurutan untuk AI-Native Store Management System (SRS v3.3).

## Alasan (keputusan D6, DATA_SCHEMA.md §5)

Raw SQL file dipilih karena:

- transparan dan dapat di-review langsung (penting untuk Supabase);
- tidak memerlukan toolchain Alembic di environment capstone;
- skema dipakai dev (`Base.metadata.create_all`) dan prod (file ini) tetap sinkron
  karena file ditulis **identik dengan ORM models** di `app/models/`.

## Cara menjalankan

```bash
cd backend
uv run python -m app.db.migrate            # apply pending
uv run python -m app.db.migrate --status   # lihat applied/pending
uv run python -m app.db.migrate --url "postgresql+asyncpg://..."  # DSN lain
```

Runner membuat tabel `schema_migrations`, lalu menerapkan file yang belum
tercatat, masing-masing dalam satu transaksi (gagal → rollback seluruh file).

## Isi file

| File | Isi |
|---|---|
| `001_initial_schema.sql` | Seluruh tabel (users → … → idempotency_keys) |
| `002_indexes_and_stock_view.sql` | Index query utama + view `v_product_stock` |
| `003_audit_append_only_trigger.sql` | Trigger `trg_audit_no_modify` (FR-AA-04) |
| `004_seed_marker.sql` | Tabel `seed_marker` (seed idempotent) |

## Keputusan skema tercatat

1. **PK UUID untuk semua tabel** (termasuk `audit_logs`, `conversation_messages`).
   DATA_SCHEMA D5 semula mengusulkan BIGINT IDENTITY untuk tabel high-volume,
   tetapi model ORM memakai UUID — konsistensi dev/prod lebih penting untuk
   capstone (≤500 SKU, single store). Dicatat untuk amendment SRS.
2. **Tidak ada CHECK constraint** untuk enum — validasi di service layer
   (konsisten dengan model; menghindari drift create_all vs migration).
   Overlap promo juga di service layer (keputusan D3).
3. **`v_product_stock.is_low_stock`** memakai `COALESCE(low_stock_threshold, 5)`
   yang mencerminkan `LOW_STOCK_THRESHOLD_DEFAULT` di backend/.env.

## Verifikasi schema

```sql
-- semua tabel inti ada
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;

-- tidak ada cart/cart_items
SELECT count(*) FROM pg_tables WHERE tablename IN ('cart','cart_items');  -- -> 0

-- view stok ada
SELECT * FROM v_product_stock LIMIT 5;

-- trigger append-only aktif
SELECT tgname FROM pg_trigger WHERE tgrelid='audit_logs'::regclass AND NOT tgisinternal;

-- coba update harus GAGAL
UPDATE audit_logs SET event='X' WHERE id IS NOT NULL;
```
