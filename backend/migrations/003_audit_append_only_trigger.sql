-- =====================================================================
-- 003_audit_append_only_trigger.sql
-- FR-AA-04 — audit_logs tidak boleh di-update/di-delete lewat SQL apapun.
-- (Service layer juga hanya menulis; ini lapisan pertahanan kedua.)
-- =====================================================================

CREATE OR REPLACE FUNCTION prevent_audit_update_delete()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only (FR-AA-04)';
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_no_modify') THEN
        CREATE TRIGGER trg_audit_no_modify
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_update_delete();
    END IF;
END $$;
