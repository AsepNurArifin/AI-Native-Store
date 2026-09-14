-- 007: fulfillment order (PICKUP/DELIVERY) — dipilih pembeli saat konfirmasi WEB.
-- JSONB agar fleibel mengikuti template fulfillment channel messaging nanti.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment JSONB;
