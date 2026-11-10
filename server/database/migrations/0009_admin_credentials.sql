-- 0009 — pencabutan sesi segera setelah perubahan akun.
-- Seluruh admin dan hash kata sandi yang sudah ada tetap dipertahankan.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;
