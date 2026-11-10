-- 0006 — checkout CASH/QRIS, snapshot pembeli, bukti privat, dan status pengiriman.
-- Kolom nullable mempertahankan lifecycle order chat/Telegram lama.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_contact VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_phone VARCHAR(30);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(4);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_review VARCHAR(8);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_review_note TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(12);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE idempotency_keys ADD COLUMN IF NOT EXISTS request_hash VARCHAR(64);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_orders_payment_method') THEN
    ALTER TABLE orders ADD CONSTRAINT ck_orders_payment_method CHECK (payment_method IN ('CASH', 'QRIS'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_orders_payment_review') THEN
    ALTER TABLE orders ADD CONSTRAINT ck_orders_payment_review CHECK (payment_review IN ('PENDING', 'VERIFIED', 'REJECTED') AND (payment_review IS NULL OR payment_method = 'QRIS'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_orders_delivery_status') THEN
    ALTER TABLE orders ADD CONSTRAINT ck_orders_delivery_status CHECK (delivery_status IN ('NOT_SHIPPED', 'SHIPPING', 'DELIVERED'));
  END IF;
END $$;

-- Satu bukti per order, ditulis dalam transaksi pembuatan order yang sama.
-- Tidak memakai Supabase Storage / URL publik. RLS menutup akses API langsung;
-- hanya server memakai koneksi PostgreSQL berprivilege dan endpoint owner JWT.
CREATE TABLE IF NOT EXISTS order_payment_proofs (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  mime VARCHAR(10) NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  size INTEGER NOT NULL CHECK (size > 0 AND size <= 2097152),
  data BYTEA NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_order_payment_proof_size CHECK (octet_length(data) = size)
);
ALTER TABLE order_payment_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON order_payment_proofs FROM PUBLIC;

CREATE INDEX IF NOT EXISTS ix_orders_payment_review ON orders (payment_review, created_at DESC) WHERE payment_method = 'QRIS';
CREATE INDEX IF NOT EXISTS ix_orders_delivery_status ON orders (delivery_status, created_at DESC) WHERE delivery_status IS NOT NULL;
