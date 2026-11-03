-- S3: additive migration. Does not modify legacy subscriptions/cases.
-- Apply ONLY after reviewing tenant/user migration state and backing up D1.
-- D1 enforces foreign keys by default.
CREATE TABLE IF NOT EXISTS billing_orders (
  order_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  m_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0 AND amount <= 1000000000),
  plan TEXT NOT NULL CHECK (plan IN ('STARTER','PRO')),
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL CHECK (period_end > period_start),
  expected_payment_key TEXT,
  payment_key TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAST_DUE','ACTIVE','REFUNDED')),
  state_rank INTEGER NOT NULL DEFAULT 0 CHECK (state_rank BETWEEN 0 AND 3),
  last_event_key TEXT,
  last_event_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (tenant_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_billing_orders_tenant_period ON billing_orders(tenant_id, period_start DESC);
CREATE TABLE IF NOT EXISTS billing_events (
  event_key TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES billing_orders(order_id) ON DELETE RESTRICT,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  payment_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','PAST_DUE','REFUNDED')),
  state_rank INTEGER NOT NULL CHECK (state_rank BETWEEN 1 AND 3),
  occurred_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(order_id,payment_key,status)
);
CREATE INDEX IF NOT EXISTS idx_billing_events_order ON billing_events(order_id, occurred_at DESC);
CREATE TABLE IF NOT EXISTS billing_entitlements (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES billing_orders(order_id) ON DELETE RESTRICT,
  payment_key TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('STARTER','PRO')),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE','PAST_DUE','REFUNDED')),
  state_rank INTEGER NOT NULL CHECK (state_rank BETWEEN 1 AND 3),
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL CHECK (period_end > period_start),
  last_event_key TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS billing_sessions (
  session_hash TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_billing_sessions_tenant_user
ON billing_sessions(tenant_id, user_id, expires_at);
