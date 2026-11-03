-- =============================================================================
-- ReturnWise Pro Database Migration 0001: Initial Multi-Tenant Schema
-- Target: Cloudflare D1 (SQLite Edge Database)
-- Standard: Strict Multi-Tenant Isolation with Foreign Keys & ON DELETE CASCADE
-- =============================================================================

PRAGMA foreign_keys = ON;

-- 1. 조직 및 테넌트 (Tenants)
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,                       -- UUID v4
    name TEXT NOT NULL,                        -- 판매 상호명 / 스토어명
    plan TEXT NOT NULL DEFAULT 'FREE',         -- 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS'
    status TEXT NOT NULL DEFAULT 'ACTIVE',     -- 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
    created_at INTEGER NOT NULL,               -- Unix Timestamp (ms)
    updated_at INTEGER NOT NULL
);

-- 2. 사용자 계정 (Users - 비밀번호 미보관, 매직링크 인증)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,                -- 셀러 로그인 이메일
    role TEXT NOT NULL DEFAULT 'OWNER',        -- 'OWNER' | 'MEMBER'
    created_at INTEGER NOT NULL,
    last_login_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 3. 반품 계산 세션 이력 (Return Sessions - No-PII 주문정보)
CREATE TABLE IF NOT EXISTS return_sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    market TEXT NOT NULL,                      -- 'SMARTSTORE' | 'COUPANG' | 'ETC'
    item_price INTEGER NOT NULL,               -- 판매가 (KRW 정수)
    initial_shipping INTEGER NOT NULL,         -- 최초 배송비
    return_shipping INTEGER NOT NULL,          -- 회수 배송비
    commission_rate REAL NOT NULL,             -- 수수료율 (예: 5.5, 10.8)
    best_option_code TEXT NOT NULL,            -- 'C01' | 'C02' | 'C03' | 'C15'
    cash_outflow INTEGER NOT NULL,             -- 추가 현금 지출액
    economic_cost INTEGER NOT NULL,            -- 순경제적 손실액
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_return_sessions_tenant ON return_sessions(tenant_id, created_at DESC);

-- 4. CSV 일괄 계산 작업 (Batch Jobs)
CREATE TABLE IF NOT EXISTS batch_jobs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    total_rows INTEGER NOT NULL,
    processed_rows INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'QUEUED',     -- 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
    result_r2_key TEXT,                        -- R2 오브젝트 스토리지 키
    created_at INTEGER NOT NULL,
    completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_batch_jobs_tenant ON batch_jobs(tenant_id, created_at DESC);

-- 5. 토스페이먼츠 정기결제 구독 (Subscriptions - 카드번호 미보관)
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    pg_provider TEXT NOT NULL DEFAULT 'TOSS',
    customer_key TEXT NOT NULL,                -- 토스 고객 고유키
    billing_key TEXT,                          -- 토스 빌링키 토큰 (자체 카드보관 0건)
    status TEXT NOT NULL DEFAULT 'ACTIVE',     -- 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
    current_period_start INTEGER NOT NULL,
    current_period_end INTEGER NOT NULL,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
