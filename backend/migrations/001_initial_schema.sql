-- =====================================================================
-- 001_initial_schema.sql
-- AI-Native Store Management System — skema awal (SRS v3.3 §6.1)
--
-- Sumber kebenaran skema: ORM models di backend/app/models/*.py
-- (create_all dipakai untuk dev/test; file ini untuk produksi/Supabase).
-- Konvensi: id UUID PK (gen_random_uuid, PG 13+); timestamptz UTC;
-- enum via VARCHAR + validasi di service layer (konsisten dengan model,
-- tidak ada CHECK constraint — menghindari drift schema dev vs prod).
--
-- Urutan: users -> products -> inventory_transactions -> customers ->
-- conversations -> conversation_messages -> recommendations -> orders ->
-- order_items -> promotions -> ai_actions -> approvals -> audit_logs ->
-- idempotency_keys (sesuai DATA_SCHEMA.md §4).
-- =====================================================================

-- ---------- users (SRS §2.2 — role hanya OWNER) ----------
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(10)  NOT NULL DEFAULT 'OWNER',
    status        VARCHAR(10)  NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------- products (FR-SA-02) ----------
CREATE TABLE products (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name               VARCHAR(200)  NOT NULL,
    category           VARCHAR(50)   NOT NULL,
    specification      JSONB         NOT NULL DEFAULT '{}',
    price              NUMERIC(14,2) NOT NULL,          -- rupiah
    status             VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE',
    low_stock_threshold INTEGER,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_products_name     ON products (name);
CREATE INDEX ix_products_category ON products (category);

-- ---------- inventory_transactions (FR-SMS-02/03 — stok SELALU agregasi) ----------
CREATE TABLE inventory_transactions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id     UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    type           VARCHAR(12) NOT NULL DEFAULT 'IN',      -- IN | OUT | ADJUSTMENT
    movement       VARCHAR(3)  NOT NULL,                   -- IN | OUT
    reference_type VARCHAR(12) NOT NULL DEFAULT 'MANUAL',  -- MANUAL | ORDER | CANCELLATION
    quantity       INTEGER     NOT NULL,                   -- selalu positif
    reference_id   UUID,                                   -- order id dsb.
    actor_id       UUID REFERENCES users (id),
    timestamp      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_inventory_transactions_product_id ON inventory_transactions (product_id);
CREATE INDEX ix_inventory_transactions_timestamp ON inventory_transactions (timestamp);

-- ---------- customers (FR-SMS-04a — identitas per channel) ----------
CREATE TABLE customers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel       VARCHAR(10)  NOT NULL,      -- WEB | WHATSAPP
    identifier    VARCHAR(150) NOT NULL,      -- WEB: name|contact | WA: phone
    name          VARCHAR(100) NOT NULL,
    contact       VARCHAR(100),
    registered_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_customer_channel_identifier UNIQUE (channel, identifier)
);

-- ---------- conversations ----------
CREATE TABLE conversations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id      UUID NOT NULL REFERENCES customers (id),
    channel          VARCHAR(10) NOT NULL,          -- WEB | WHATSAPP
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at         TIMESTAMPTZ,
    outcome          VARCHAR(20)
);
CREATE INDEX ix_conversations_customer_id ON conversations (customer_id);

-- ---------- conversation_messages ----------
CREATE TABLE conversation_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    sender          VARCHAR(10) NOT NULL,            -- CUSTOMER | AI
    content         TEXT        NOT NULL,
    message_type    VARCHAR(12) NOT NULL DEFAULT 'TEXT',
    raw_payload     JSONB,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_conversation_messages_conversation_id ON conversation_messages (conversation_id);
CREATE INDEX ix_conversation_messages_timestamp      ON conversation_messages (timestamp);

-- ---------- recommendations ----------
CREATE TABLE recommendations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products (id),
    reason          TEXT NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_recommendations_conversation_id ON recommendations (conversation_id);

-- ---------- orders (FR-SMS-06 — dibuat langsung dari summary, tanpa Cart) ----------
CREATE TABLE orders (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id       UUID NOT NULL REFERENCES customers (id),
    status            VARCHAR(12)  NOT NULL DEFAULT 'CONFIRMED',
    conversation_id   UUID REFERENCES conversations (id),
    channel_origin    VARCHAR(10)  NOT NULL,          -- WEB | WHATSAPP
    total_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
    promotion_snapshot JSONB,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completed_at      TIMESTAMPTZ,
    cancelled_at      TIMESTAMPTZ
);
CREATE INDEX ix_orders_customer_id ON orders (customer_id);

-- ---------- order_items ----------
CREATE TABLE order_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id       UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    product_id     UUID NOT NULL REFERENCES products (id),
    quantity       INTEGER NOT NULL,                  -- > 0 divalidasi service
    price_at_order NUMERIC(14,2) NOT NULL,            -- snapshot harga (SRS §6.2)
    line_total     NUMERIC(14,2) NOT NULL
);
CREATE INDEX ix_order_items_order_id ON order_items (order_id);

-- ---------- promotions ----------
CREATE TABLE promotions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id          UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    discount_percentage NUMERIC(5,2) NOT NULL,
    start_date          TIMESTAMPTZ NOT NULL,
    end_date            TIMESTAMPTZ NOT NULL,
    status              VARCHAR(12) NOT NULL DEFAULT 'DRAFT',  -- DRAFT | ACTIVE | EXPIRED | REJECTED
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_promotions_product_id ON promotions (product_id);

-- ---------- ai_actions (AI Action Assistant — draft/approve/execute) ----------
CREATE TABLE ai_actions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type         VARCHAR(30) NOT NULL,          -- CREATE_PROMOTION | STOCK_ADJUSTMENT
    payload             JSONB NOT NULL,
    status              VARCHAR(28) NOT NULL DEFAULT 'DRAFT',
    requested_by        UUID NOT NULL REFERENCES users (id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at          TIMESTAMPTZ,
    executed_at         TIMESTAMPTZ,
    result_target_id    UUID,                           -- promotion id hasil eksekusi
    validation_failures JSONB
);

-- ---------- approvals ----------
CREATE TABLE approvals (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_action_id UUID NOT NULL REFERENCES ai_actions (id) ON DELETE CASCADE,
    actor_id     UUID NOT NULL REFERENCES users (id),  -- harus OWNER
    decision     VARCHAR(10) NOT NULL,                 -- APPROVED | REJECTED
    note         TEXT,
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_approvals_ai_action_id ON approvals (ai_action_id);

-- ---------- audit_logs (FR-AA-04 — append-only) ----------
CREATE TABLE audit_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_action_id UUID REFERENCES ai_actions (id),
    event        VARCHAR(20) NOT NULL,   -- CREATED | APPROVED | REJECTED | VALIDATION_FAILED | EXECUTED
    actor_type   VARCHAR(10) NOT NULL,   -- USER | AI_SYSTEM
    actor_id     UUID REFERENCES users (id),
    detail       JSONB NOT NULL DEFAULT '{}',
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_logs_timestamp ON audit_logs (timestamp);

-- ---------- idempotency_keys (UC-02 E5 — cegah order ganda) ----------
CREATE TABLE idempotency_keys (
    key        VARCHAR(64) PRIMARY KEY,
    order_id   UUID REFERENCES orders (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
