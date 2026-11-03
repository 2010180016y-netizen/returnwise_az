-- =============================================================================
-- Migration 0002: Return Cases Schema with Idempotency, Retention & Lifecycle
-- Target: Cloudflare D1 (SQLite Edge Database)
-- Special Security: No customer names, delivery addresses, or external order numbers!
-- =============================================================================

CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,                       -- Internal caseId (e.g. 'case_202611_abc123')
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    idempotency_key TEXT UNIQUE,               -- 멱등성 보장 키 (중복 저장 방지)
    market TEXT NOT NULL,                      -- 'SMARTSTORE' | 'COUPANG' | 'ETC'
    item_price INTEGER NOT NULL,               -- 판매가 (KRW 정수)
    initial_shipping INTEGER NOT NULL,         -- 초기 배송비
    return_shipping INTEGER NOT NULL,          -- 회수 배송비
    commission_rate REAL NOT NULL,             -- 수수료율
    best_option_code TEXT NOT NULL,            -- 'C01' | 'C02' | 'C03' | 'C15'
    cash_outflow INTEGER NOT NULL,             -- 추가 현금 지출액
    economic_cost INTEGER NOT NULL,            -- 순경제적 손실액
    policy_verified INTEGER NOT NULL DEFAULT 1,-- 2026 전자상거래법 게이트 통과 여부 (1=PASS)
    retention_expires_at INTEGER NOT NULL,     -- 데이터 보존 만료일 (Unix ms)
    is_deleted INTEGER NOT NULL DEFAULT 0,     -- 논리 삭제 플래그 (0=활성, 1=삭제)
    created_at INTEGER NOT NULL,               -- 생성 시점 (Unix ms)
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cases_tenant_created ON cases(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_idempotency ON cases(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_cases_retention ON cases(retention_expires_at);
