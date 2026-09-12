-- =====================================================================
-- 006_drop_subscriptions.sql
-- Pivot produk: SaaS -> single-user (docs/SRS_AMENDMENTS.md §E).
-- Funnel subscribe (005) dihapus dari aplikasi; tabel ikut di-drop.
-- Fresh install: 005 create lalu 006 drop (net kosong, riwayat utuh).
-- =====================================================================

DROP TABLE IF EXISTS subscriptions;
