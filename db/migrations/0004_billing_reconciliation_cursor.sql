-- 0004: Non-destructive forward-only migration for reconciliation fairness and event recency.
-- Requires backup/rehearsal before real Cloudflare D1 apply. Never touches historic payment keys.
ALTER TABLE billing_orders ADD COLUMN next_reconcile_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE billing_orders ADD COLUMN reconcile_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE billing_entitlements ADD COLUMN last_event_at INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_billing_orders_reconcile_due
ON billing_orders(next_reconcile_at, order_id)
WHERE payment_key IS NOT NULL AND status IN ('ACTIVE','PAST_DUE');
-- Store an exact, previously calculated reference value; never reconstruct
-- financial 'savings' from item price, commission rate or assumed shipping.
ALTER TABLE cases ADD COLUMN baseline_economic_cost INTEGER;
