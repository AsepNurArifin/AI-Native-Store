-- Marketplace redesign: tambah kolom gambar produk (nullable, URL / path statis).
-- Aman diulang. Jalankan via: psql $DATABASE_URL -f server/database/migrations/0002_product_image_url.sql
-- atau npx drizzle-kit push (schema.ts sudah memuat kolom ini).
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);
CREATE INDEX IF NOT EXISTS ix_products_image ON products (image_url) WHERE image_url IS NOT NULL;
