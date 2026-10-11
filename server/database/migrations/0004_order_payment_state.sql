-- 0004 — payment state pada orders.
--
-- MASALAH: order lahir langsung berstatus 'CONFIRMED' dan stok langsung dikurangi,
-- padahal QRIS hanya SIMULASI (merchant ID contoh, app/utils/qris.ts) — tidak ada
-- webhook payment gateway sama sekali. Akibatnya:
--   1. agents.ts isCountableOrder() = CONFIRMED || COMPLETED -> order yang BELUM
--      dibayar ikut terhitung sebagai "pendapatan" di analyze_sales /
--      channel_distribution / analyze_inventory.
--   2. Order abandoned (pelanggan scan QR lalu pergi) menahan stok PERMANEN —
--      tidak ada state pending, tidak ada TTL, satu-satunya jalan keluar cancel manual.
--
-- SOLUSI: pisahkan "order dibuat" dari "sudah dibayar" lewat kolom payment_status
-- (bukan menambah status baru — kolom orders.status tetap VARCHAR(12), dan
-- 'PENDING_PAYMENT' = 15 char tidak akan muat).
--
-- STATUS BARU:
--   status=CONFIRMED + payment_status=UNPAID  -> baru dibuat, stok di-reserve
--        |-> POST /orders/:id/pay      => payment_status=PAID, paid_at=now
--        |-> POST /orders/:id/cancel   => CANCELLED + stok kembali
--        |-> lewat TTL (lazy expire)   => CANCELLED + stok kembali
--   status=COMPLETED  (hanya boleh dari CONFIRMED yang SUDAH PAID)
--
-- Dijalankan via: psql "$DATABASE_URL" -f server/database/migrations/0004_order_payment_state.sql
-- Aman diulang (IF NOT EXISTS). Tanpa backfill: DB masih berisi seed demo saja.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(12) NOT NULL DEFAULT 'UNPAID';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at  TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Index untuk lazy expire (cari UNPAID yang lewat TTL) dan filter analitik.
CREATE INDEX IF NOT EXISTS ix_orders_payment ON orders (payment_status, status);
CREATE INDEX IF NOT EXISTS ix_orders_expires ON orders (expires_at) WHERE payment_status = 'UNPAID';

-- Jaga integritas: orders yang sudah COMPLETED/ CANCELLED tidak boleh UNPAID.
-- (COMPLETED hanya bisa terjadi setelah PAID — dijaga juga di service layer.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM orders
    WHERE status IN ('COMPLETED','CANCELLED') AND payment_status = 'UNPAID'
  ) THEN
    UPDATE orders SET payment_status = 'PAID', paid_at = COALESCE(completed_at, created_at)
    WHERE status IN ('COMPLETED','CANCELLED') AND payment_status = 'UNPAID';
  END IF;
END $$;