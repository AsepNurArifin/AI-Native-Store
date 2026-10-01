-- Fullstack Nuxt migration 0001 — port backend/migrations/001-003 ke Nitro/Drizzle.
-- Dijalankan via: npx drizzle-kit push  ATAU  psql $DATABASE_URL -f server/database/migrations/0001_init.sql
-- Aman diulang (IF NOT EXISTS). Setelah ini backend/ Python tidak dipakai lagi.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'OWNER',
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(10) NOT NULL,
  identifier VARCHAR(150) NOT NULL,
  name VARCHAR(100),
  contact VARCHAR(100),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_customer_channel_identifier UNIQUE (channel, identifier)
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  specification JSONB NOT NULL DEFAULT '{}',
  price NUMERIC(14,2) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
  low_stock_threshold INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_products_name ON products (name);
CREATE INDEX IF NOT EXISTS ix_products_category ON products (category);

CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  discount_percentage NUMERIC(5,2) NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_promotions_product ON promotions (product_id);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type VARCHAR(12) NOT NULL DEFAULT 'IN',
  movement VARCHAR(3) NOT NULL,
  reference_type VARCHAR(12) NOT NULL DEFAULT 'MANUAL',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reference_id UUID,
  actor_id UUID,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_inv_tx_product ON inventory_transactions (product_id);
CREATE INDEX IF NOT EXISTS ix_inv_tx_ts ON inventory_transactions (timestamp);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  channel VARCHAR(10) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  outcome VARCHAR(20)
);
CREATE INDEX IF NOT EXISTS ix_conv_customer ON conversations (customer_id);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender VARCHAR(10) NOT NULL,
  content TEXT NOT NULL,
  message_type VARCHAR(12) NOT NULL DEFAULT 'TEXT',
  raw_payload JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_msg_conv ON conversation_messages (conversation_id);
CREATE INDEX IF NOT EXISTS ix_msg_ts ON conversation_messages (timestamp);

CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  reason TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_rec_conv ON recommendations (conversation_id);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  status VARCHAR(12) NOT NULL DEFAULT 'CONFIRMED',
  conversation_id UUID REFERENCES conversations(id),
  channel_origin VARCHAR(10) NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  promotion_snapshot JSONB,
  fulfillment JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_orders_customer ON orders (customer_id);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_at_order NUMERIC(14,2) NOT NULL,
  line_total NUMERIC(14,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_order_items_order ON order_items (order_id);

CREATE TABLE IF NOT EXISTS ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(30) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(28) NOT NULL DEFAULT 'DRAFT',
  requested_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  result_target_id VARCHAR(64),
  validation_failures JSONB
);
CREATE INDEX IF NOT EXISTS ix_ai_actions_status ON ai_actions (status);

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_action_id UUID NOT NULL REFERENCES ai_actions(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id),
  decision VARCHAR(10) NOT NULL,
  note TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_approvals_action ON approvals (ai_action_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_action_id UUID REFERENCES ai_actions(id),
  event VARCHAR(20) NOT NULL,
  actor_type VARCHAR(10) NOT NULL,
  actor_id UUID REFERENCES users(id),
  detail JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_audit_ts ON audit_logs (timestamp);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(64) PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- View stok (ganti v_product_stock backend)
CREATE OR REPLACE VIEW v_product_stock AS
SELECT p.id AS product_id, p.name, p.category, p.status,
  COALESCE(SUM(CASE WHEN t.movement = 'IN' THEN t.quantity ELSE -t.quantity END), 0)::BIGINT AS current_stock,
  p.low_stock_threshold,
  (COALESCE(SUM(CASE WHEN t.movement = 'IN' THEN t.quantity ELSE -t.quantity END), 0) <= COALESCE(p.low_stock_threshold, 5)) AS is_low_stock
FROM products p LEFT JOIN inventory_transactions t ON t.product_id = p.id
GROUP BY p.id;

-- Trigger audit append-only (port backend/migrations/003)
CREATE OR REPLACE FUNCTION prevent_audit_update_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs append-only: % tidak diizinkan', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_no_modify ON audit_logs;
CREATE TRIGGER trg_audit_no_modify
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_update_delete();
