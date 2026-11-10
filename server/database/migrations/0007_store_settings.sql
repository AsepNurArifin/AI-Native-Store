CREATE TABLE IF NOT EXISTS store_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name VARCHAR(100) NOT NULL DEFAULT 'SHAF STORE',
  owner_name VARCHAR(100) NOT NULL DEFAULT 'Pemilik Toko',
  qris_merchant_name VARCHAR(100) NOT NULL DEFAULT '',
  qris_image_url VARCHAR(500),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_store_qris_name CHECK (qris_image_url IS NULL OR length(trim(qris_merchant_name)) > 0)
);
INSERT INTO store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
