-- =====================================================================
-- 005_subscriptions.sql
-- Fase 2 PLAN_PRODUCT_LAUNCH.md — pendaftaran langganan SaaS dari landing.
-- Mock billing: status PENDING -> diaktivasi manual (provisioning otomatis
-- = future work).
-- =====================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_name VARCHAR(100) NOT NULL,
    owner_name VARCHAR(100) NOT NULL,
    contact    VARCHAR(150) NOT NULL,          -- email atau nomor WA
    plan       VARCHAR(20)  NOT NULL DEFAULT 'trial',   -- trial|monthly|yearly|topup
    status     VARCHAR(20)  NOT NULL DEFAULT 'PENDING', -- PENDING|ACTIVATED|REJECTED
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_subscriptions_status ON subscriptions (status);
