-- 0005 — index performa untuk list admin & housekeeping idempotency.
--
-- LATAR: beberapa query yang tumbuh seiring data tanpa index pendukung —
-- setiap request list admin melakukan seq-scan + sort:
--   1. GET /orders            -> ORDER BY created_at DESC (list kasir)
--   2. GET /conversations     -> ORDER BY last_activity_at DESC
--   3. produk hapus/aggregate  -> DELETE ... filter / COUNT per order_items.product_id
--   4. getSummary/popSummary  -> order_summaries WHERE conversation_id
--   5. DELETE idempotency_keys WHERE created_at < ... (dipanggil dari
--      cleanupIdempotencyKeys, dulu per-pesan-webhook tanpa index)
--
-- Dijalankan via: psql "$DATABASE_URL" -f server/database/migrations/0005_performance_indexes.sql
-- Aman diulang (IF NOT EXISTS). Semua CREATE INDEX biasa (tabel masih kecil —
-- tidak butuh CONCURRENTLY); pada tabel sangat besar jalankan saat idle.
-- Nama kolom mengikuti konvensi snake_case yang dipakai migrasi 0001–0004.

CREATE INDEX IF NOT EXISTS ix_orders_created       ON orders (created_at);
CREATE INDEX IF NOT EXISTS ix_conv_last_activity   ON conversations (last_activity_at);
CREATE INDEX IF NOT EXISTS ix_order_items_product  ON order_items (product_id);
CREATE INDEX IF NOT EXISTS ix_order_summaries_conv ON order_summaries (conversation_id);
CREATE INDEX IF NOT EXISTS ix_idem_created         ON idempotency_keys (created_at);
