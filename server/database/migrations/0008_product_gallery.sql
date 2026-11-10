-- 0008 — galeri berurutan; gambar pertama menjadi sampul API image_url.
BEGIN;

ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
UPDATE products SET image_urls = '[]'::jsonb WHERE image_urls IS NULL;
ALTER TABLE products ALTER COLUMN image_urls SET DEFAULT '[]'::jsonb;
ALTER TABLE products ALTER COLUMN image_urls SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'image_url'
  ) THEN
    EXECUTE 'UPDATE products SET image_urls = jsonb_build_array(btrim(image_url))
      WHERE image_urls = ''[]''::jsonb AND image_url IS NOT NULL AND btrim(image_url) <> ''''';
    ALTER TABLE products DROP COLUMN image_url;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_products_image_urls' AND conrelid = 'products'::regclass) THEN
    ALTER TABLE products ADD CONSTRAINT ck_products_image_urls CHECK (
      CASE WHEN jsonb_typeof(image_urls) = 'array' THEN
        jsonb_array_length(image_urls) <= 10 AND NOT jsonb_path_exists(image_urls, '$[*] ? (@.type() != "string")')
      ELSE FALSE END
    );
  END IF;
END $$;

COMMIT;
