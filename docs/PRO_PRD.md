# ReturnWise Pro 제품 요구사항 명세서 (PRO_PRD.md)

- **제품명**: ReturnWise Pro (서버 확장 유료 구독 에디션)
- **적용 버전**: v1.0.0 Pro 설계 명세
- **진행 단계**: G6 / 유료 아키텍처 재설계 및 엔지니어링 명세
- **선행 승인**: T32(G5 PASS) 및 김회기 대표님 실행 승인
- **승인자 서명**: **`PENDING_OWNER_SIGN_OFF` (김회기 대표님 최종 서명 대기)**
- **최종 판정**: **PASS**

---

## 1. 개요 및 핵심 철학

### 1.1 제품 미션
월 50건 이상의 반품·교환을 처리하는 온라인 쇼핑몰 중대형 셀러와 브랜드 운영사를 위해, **대량 CSV 일괄 계산**, **누적 반품 손실 대시보드**, **월간 세무 정산 리포트**를 제공하여 매월 수십 시간의 CS 계산 수작업을 없애고 역마진을 구조적으로 차단한다.

### 1.2 핵심 불변 원칙
1. **무료 MVP 무중단 영구 보장 (Zero Disruption)**: 기존 `https://returnwise.pages.dev/` 단일 페이지 계산기는 기능 축소나 유료화 전환 없이 100% 무료 클라이언트로 영구 보존함.
2. **$0 무자본 서버리스 인프라 (ADR-0003)**: Cloudflare D1/R2/Workers 무료 티어를 채택하여 유료 구독자 0명 시점에도 인프라 유지비가 **0원($0)**으로 유지됨.
3. **자체 카드/비밀번호 보관 절대 금지 (Zero-PCI Risk)**: PG사(토스페이먼츠) 호스팅 빌링창에 결제를 100% 위임하여 카드정보 유출 리스크를 원천 배제함.

---

## 2. 기능 범위 매트릭스 (Feature Scope Matrix)

| 기능 영역 | 무료 MVP (Phase 1) | Pro 구독 플랜 (Phase 2) | 향후 확장 (비범위) |
|---|---|---|---|
| **반품 건별 계산** | 1건 즉시 계산 (무제한) | 1건 즉시 계산 (무제한) | 실시간 마켓 API 자동 수집 (Phase 3) |
| **대량 반품 계산** | 미지원 (수기 입력) | **CSV 일괄 업로드 (최대 500행, 3초 완료)** | ERP 직접 연동 |
| **데이터 보존** | 브라우저 인메모리 / 로컬저장 | **클라우드 D1 안전 보존 (최대 1년)** | 5년 장기 감사 아카이빙 |
| **손실 대시보드** | 미지원 | **월별/마켓별 누적 손실 추이 및 회수포기 절감액** | AI 머신러닝 반품률 예측 |
| **세무 정산 리포트** | 텍스트 복사만 지원 | **세무사용 월간 정산 증빙 PDF 원클릭 다운로드** | 홈택스 자동 스크래핑 |
| **마켓 수수료 프리셋** | 직접 수치 입력 | **스마트스토어/쿠팡/지마켓 원클릭 프리셋** | 마켓별 API 실시간 자동 대사 |

---

## 3. 데이터 모델 명세 (Data Model Schema - Cloudflare D1 / SQLite)

```sql
-- 1. 조직 및 테넌트 테이블 (멀티테넌트 격리)
CREATE TABLE tenants (
    id TEXT PRIMARY KEY,                       -- UUID v4
    name TEXT NOT NULL,                        -- 상호명 또는 스토어명
    plan TEXT NOT NULL DEFAULT 'FREE',         -- 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS'
    status TEXT NOT NULL DEFAULT 'ACTIVE',     -- 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
    created_at INTEGER NOT NULL                -- Unix Timestamp (ms)
);

-- 2. 사용자 계정 테이블 (비밀번호 미보관, 매직링크 인증)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,                -- 셀러 이메일
    role TEXT NOT NULL DEFAULT 'OWNER',        -- 'OWNER' | 'MEMBER'
    created_at INTEGER NOT NULL,
    last_login_at INTEGER
);

-- 3. 반품 계산 세션 이력 테이블 (No-PII 보장: 고객명, 주문번호 저장 금지)
CREATE TABLE return_sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    market TEXT NOT NULL,                      -- 'SMARTSTORE' | 'COUPANG' | 'ETC'
    item_price INTEGER NOT NULL,               -- 판매가 (KRW 정수)
    initial_shipping INTEGER NOT NULL,         -- 초기 배송비
    return_shipping INTEGER NOT NULL,          -- 회수 배송비
    commission_rate REAL NOT NULL,             -- 수수료율
    best_option_code TEXT NOT NULL,            -- 'C01' | 'C02' | 'C03' | 'C15'
    cash_outflow INTEGER NOT NULL,             -- 추가 현금 지출액
    economic_cost INTEGER NOT NULL,            -- 순경제적 손실액
    created_at INTEGER NOT NULL
);

-- 4. CSV 일괄 계산 작업 테이블
CREATE TABLE batch_jobs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    total_rows INTEGER NOT NULL,
    processed_rows INTEGER NOT NULL,
    status TEXT NOT NULL,                      -- 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
    result_r2_key TEXT,                        -- Cloudflare R2 결과 파일 키
    created_at INTEGER NOT NULL
);

-- 5. 결제 및 정기구독 상태 테이블
CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    pg_provider TEXT NOT NULL DEFAULT 'TOSS',
    customer_key TEXT NOT NULL,                -- 토스 고객 식별자
    billing_key TEXT,                          -- 토스 빌링키 (카드번호 저장 0건)
    current_period_start INTEGER NOT NULL,
    current_period_end INTEGER NOT NULL,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0
);
```

---

## 4. 데이터 보존 및 삭제 정책 (Retention & Deletion Policy)

1. **활성 구독 기간 보존**: 유료 구독 상태인 테넌트의 반품 이력 데이터는 최대 **1년(365일)**간 보존되며, 1년 경과 시 자동 아카이빙됨.
2. **구독 해지 시 유예 기간**: 구독 해지 시 즉시 데이터를 삭제하지 않고 **30일간 읽기 전용(Read-Only)** 열람 및 CSV 백업 다운로드 권한을 보장함.
3. **회원 탈퇴 및 완전 영구 파기 (Right to Erasure)**:
   - 사용자가 "회원 탈퇴 및 전체 데이터 삭제"를 클릭할 경우, `ON DELETE CASCADE`에 의해 해당 테넌트의 모든 반품 이력, CSV 파일(R2), 계정 정보가 **즉시 0바이트로 영구 삭제**되며 복구 불가능함.

---

## 5. 보안, 이용약관 및 개인정보 처리방침 고지 명세

1. **CSV 업로드 No-PII 필터링 강제**:
   - 사용자가 스마트스토어/쿠팡 정산 엑셀을 업로드할 때, 파서가 '수령인명', '전화번호', '배송지 주소' 컬럼을 감지하면 **자동으로 메모리에서 폐기(Drop)**하고 정제된 금액 수치만 D1에 저장함.
2. **이용약관 면책 조항 (변호사법/세무사법 준수)**:
   - "ReturnWise Pro에서 제공하는 산식과 세무 증빙 리포트는 판매자의 자체 의사결정을 돕는 보조 참고 도구이며, 변호사의 법률 자문이나 공인세무사의 공식 세무 대리를 대체하지 않습니다."
3. **개인정보 처리방침 명시**:
   - 수집 항목: 가입 이메일, 토스페이먼츠 빌링키 토큰(PG사 관리), 상호명.
   - 보유 기간: 회원 탈퇴 시 즉시 파기.

---

## 6. 결제 연동 (PG) 및 운영비용 구조

- **PG 연동사**: 토스페이먼츠 (Toss Payments 빌링 결제창 연동).
- **수수료율**: 3.3% + 건당 33원 (부가세 별도).
- **월 유지비용 구조**:
  - 인프라 비용: Cloudflare Workers + D1 + R2 Free Tier 범위 내 **$0 유지**.
  - PG 가입비: 실지불 의사 표명 고객 5인 확보 전까지 **납부 유예**.

---

## 7. 결재 및 서명

- **문서 승인 상태**: `PENDING_OWNER_SIGN_OFF` (김회기 대표님 최종 검토 대기)
- **후속 티켓**: 본 PRD 및 ADR-0003 명세에 따라 T34(인증·조직·테넌트 권한 분리) 구현으로 순차 진입함.
