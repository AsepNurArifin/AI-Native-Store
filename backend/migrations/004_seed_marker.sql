-- =====================================================================
-- 004_seed_marker.sql
-- Marker seed idempotent (DATA_SCHEMA.md §4) — mencegah seed dobel saat
-- migration/startup dijalankan ulang. Dipakai oleh app.seed.generate.
-- =====================================================================

CREATE TABLE IF NOT EXISTS seed_marker (
    marker     VARCHAR(64) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insersi dasar tidak berbahaya: seed tetap dieksekusi oleh app (lihat
-- app/db/init_db.py yang memeriksa tabel users kosong / seed_marker).
INSERT INTO seed_marker (marker) VALUES ('schema_initialized')
ON CONFLICT (marker) DO NOTHING;
