-- =============================================================================
-- Migration 0002 Rollback: Revert Return Cases Schema
-- =============================================================================

DROP INDEX IF EXISTS idx_cases_retention;
DROP INDEX IF EXISTS idx_cases_idempotency;
DROP INDEX IF EXISTS idx_cases_tenant_created;
DROP TABLE IF EXISTS cases;
