-- =====================================================================
-- 002_indexes_and_stock_view.sql
-- Index query utama + view stok (DATA_SCHEMA.md §3).
-- View = read-only convenience; stok SELALU agregasi inventory_transactions.
-- =====================================================================

-- ---------- index pendukung query (DATA_SCHEMA §3) ----------
CREATE INDEX ix_conversations_last_activity ON conversations (last_activity_at DESC);  -- monitoring percakapan
CREATE INDEX ix_orders_created_at           ON orders (created_at);                    -- laporan penjualan
CREATE INDEX ix_order_items_product_id      ON order_items (product_id);               -- produk terlaris (FR-BA)
CREATE INDEX ix_inventory_transactions_reference_id ON inventory_transactions (reference_id); -- lookup cancel/rollback
CREATE INDEX ix_audit_logs_ai_action_id     ON audit_logs (ai_action_id);              -- trace AI Action lifecycle
CREATE INDEX ix_ai_actions_status           ON ai_actions (status);                    -- daftar draft menunggu approval

-- ---------- v_product_stock ----------
-- (product_id, current_stock, is_low_stock) — DATA_SCHEMA.md §2/D2.
-- Catatan: konstanta 5 di bawah hanya skema awal. Backend me-recreate view ini
-- saat startup (app/db/init_db.py) memakai LOW_STOCK_THRESHOLD_DEFAULT dari
-- backend/.env — single source of truth ada di config, bukan di SQL ini.
CREATE OR REPLACE VIEW v_product_stock AS
SELECT
    p.id                  AS product_id,
    p.name                AS name,
    p.category            AS category,
    p.status              AS status,
    COALESCE(SUM(
        CASE it.movement WHEN 'IN' THEN it.quantity ELSE -it.quantity END
    ), 0)::BIGINT         AS current_stock,
    p.low_stock_threshold AS low_stock_threshold,
    (
        COALESCE(SUM(
            CASE it.movement WHEN 'IN' THEN it.quantity ELSE -it.quantity END
        ), 0)::BIGINT <= COALESCE(p.low_stock_threshold, 5)
    )                     AS is_low_stock
FROM products p
LEFT JOIN inventory_transactions it ON it.product_id = p.id
GROUP BY p.id;
