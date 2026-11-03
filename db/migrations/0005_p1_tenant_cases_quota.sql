-- P1/0005: Fail-closed tenant-scoped cases and atomic D1 usage counters.
-- Forward-only: retained old schema/data in cases_legacy_p1 for independent review.
-- No DROP/DELETE. Legacy verification claims are deliberately reset to 0.
-- Required operator step for existing remote DB: backup + controlled staging rehearsal.

ALTER TABLE cases RENAME TO cases_legacy_p1;

CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  idempotency_key TEXT,
  market TEXT NOT NULL,
  item_price INTEGER NOT NULL,
  initial_shipping INTEGER NOT NULL,
  return_shipping INTEGER NOT NULL,
  commission_rate REAL NOT NULL,
  best_option_code TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED',
  cash_outflow INTEGER NOT NULL,
  economic_cost INTEGER NOT NULL,
  policy_verified INTEGER NOT NULL DEFAULT 0 CHECK (policy_verified IN (0,1)),
  retention_expires_at INTEGER NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0,1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  baseline_economic_cost INTEGER,
  UNIQUE(tenant_id,idempotency_key)
);

-- Preserve every legacy row, but DO NOT trust an old default=1 as proof
-- of an affirmative review. Recommendations need manual re-attestation.
INSERT INTO cases (
  id,tenant_id,idempotency_key,market,item_price,initial_shipping,
  return_shipping,commission_rate,best_option_code,cash_outflow,economic_cost,
  policy_verified,retention_expires_at,is_deleted,created_at,updated_at,baseline_economic_cost
)
SELECT
  id,tenant_id,idempotency_key,market,item_price,initial_shipping,
  return_shipping,commission_rate,'REVIEW_REQUIRED',cash_outflow,economic_cost,
  0,retention_expires_at,is_deleted,created_at,updated_at,NULL
FROM cases_legacy_p1;

CREATE INDEX idx_cases_p1_tenant_created ON cases(tenant_id,created_at DESC);
CREATE INDEX idx_cases_p1_retention ON cases(retention_expires_at);

-- Persistent deletion ledger: a previously removed case cannot be inserted
-- again by restoring an old SQL backup into the app's normal case API.
CREATE TABLE case_tombstones (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL,
  idempotency_key TEXT,
  deleted_at INTEGER NOT NULL,
  PRIMARY KEY(tenant_id,case_id)
);
CREATE UNIQUE INDEX idx_case_tombstones_idempotency
ON case_tombstones(tenant_id,idempotency_key)
WHERE idempotency_key IS NOT NULL;
INSERT INTO case_tombstones(tenant_id,case_id,idempotency_key,deleted_at)
SELECT tenant_id,id,idempotency_key,updated_at FROM cases WHERE is_deleted=1;

CREATE TRIGGER cases_p1_no_deleted_reinsert
BEFORE INSERT ON cases
WHEN EXISTS (
  SELECT 1 FROM case_tombstones
  WHERE tenant_id=NEW.tenant_id AND (
    case_id=NEW.id OR
    (NEW.idempotency_key IS NOT NULL AND idempotency_key=NEW.idempotency_key)
  )
)
BEGIN
  SELECT RAISE(ABORT,'CASE_TOMBSTONED');
END;

CREATE TRIGGER cases_p1_no_deleted_reactivate
BEFORE UPDATE OF is_deleted ON cases
WHEN OLD.is_deleted=1 AND NEW.is_deleted=0
  OR (NEW.is_deleted=0 AND EXISTS (
    SELECT 1 FROM case_tombstones
    WHERE tenant_id=NEW.tenant_id AND case_id=NEW.id
  ))
BEGIN
  SELECT RAISE(ABORT,'CASE_TOMBSTONED');
END;

CREATE TRIGGER cases_p1_soft_delete
AFTER UPDATE OF is_deleted ON cases
WHEN OLD.is_deleted=0 AND NEW.is_deleted=1
BEGIN
  INSERT INTO case_tombstones(tenant_id,case_id,idempotency_key,deleted_at)
  VALUES(NEW.tenant_id,NEW.id,NEW.idempotency_key,NEW.updated_at)
  ON CONFLICT(tenant_id,case_id) DO UPDATE SET
    idempotency_key=COALESCE(excluded.idempotency_key,case_tombstones.idempotency_key),
    deleted_at=MAX(case_tombstones.deleted_at,excluded.deleted_at);
END;

CREATE TRIGGER cases_p1_hard_delete
AFTER DELETE ON cases
BEGIN
  INSERT INTO case_tombstones(tenant_id,case_id,idempotency_key,deleted_at)
  VALUES(OLD.tenant_id,OLD.id,OLD.idempotency_key,OLD.updated_at)
  ON CONFLICT(tenant_id,case_id) DO UPDATE SET
    idempotency_key=COALESCE(excluded.idempotency_key,case_tombstones.idempotency_key),
    deleted_at=MAX(case_tombstones.deleted_at,excluded.deleted_at);
END;

CREATE TABLE quota_usage (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK(length(month)=7),
  used_rows INTEGER NOT NULL DEFAULT 0 CHECK(used_rows>=0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(tenant_id,month)
);

CREATE TABLE quota_reservations (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  month TEXT NOT NULL,
  row_count INTEGER NOT NULL CHECK(row_count BETWEEN 1 AND 1000),
  plan TEXT NOT NULL CHECK(plan IN ('STARTER','PRO')),
  limit_rows INTEGER NOT NULL CHECK(limit_rows>0),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(tenant_id,request_id),
  FOREIGN KEY(tenant_id,month) REFERENCES quota_usage(tenant_id,month) ON DELETE CASCADE
);

-- Trigger performs the authorization-critical arithmetic inside the D1
-- INSERT transaction, not in an application read-modify-write sequence.
CREATE TRIGGER quota_p1_reject_over_limit
BEFORE INSERT ON quota_reservations
WHEN NOT EXISTS (
  SELECT 1 FROM quota_usage AS u
  WHERE u.tenant_id=NEW.tenant_id AND u.month=NEW.month
    AND u.used_rows<=NEW.limit_rows-NEW.row_count
)
BEGIN
  SELECT RAISE(ABORT,'QUOTA_EXCEEDED');
END;

CREATE TRIGGER quota_p1_charge_exactly_once
AFTER INSERT ON quota_reservations
BEGIN
  UPDATE quota_usage
    SET used_rows=used_rows+NEW.row_count,updated_at=NEW.created_at
  WHERE tenant_id=NEW.tenant_id AND month=NEW.month;
END;

CREATE INDEX idx_quota_reservations_tenant_month
ON quota_reservations(tenant_id,month);
