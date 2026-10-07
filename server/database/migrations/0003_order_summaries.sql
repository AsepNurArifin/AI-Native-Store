-- 0003 — tabel order_summaries (price lock, TTL 30 menit) + catatan backfill.
-- Dijalankan via: psql "$DATABASE_URL" -f server/database/migrations/0003_order_summaries.sql
-- Aman diulang (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS order_summaries (
  summary_ref VARCHAR(32) PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  channel VARCHAR(10) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_summary_expires ON order_summaries (expires_at);

-- Opsional (MANUAL, setelah backup): samakan historis price_at_order ke semantik
-- baru = harga efektif per unit (net) agar qty x price_at_order == line_total.
-- Harga asli tetap terbaca dari orders.promotion_snapshot.
-- UPDATE order_items i SET price_at_order = i.line_total / NULLIF(i.quantity, 0)
-- WHERE EXISTS (
--   SELECT 1 FROM orders o WHERE o.id = i.order_id AND o.promotion_snapshot IS NOT NULL
-- );
