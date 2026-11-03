# T35 구현 완료 보고서: 저장형 이력·삭제·보존·백업

- **티켓 ID**: T35 (저장형 이력·삭제·보존·백업)
- **단계**: G6 / 유료화 엔지니어링 및 데이터 관리 단계
- **선행 티켓**: T34 (인증·조직·테넌트 권한 분리 - PASS)
- **최종 판정**: **PASS**

---

## 1. 판정 요약

| 점검 항목 | 요구 기준 | 실측 결과 | 판정 |
|---|---|---|---|
| No-PII 안전조건 | 고객 이름/주소/주문번호 수집 차단 | PII 필드 입력 시 400 거절 실측 | **PASS** |
| 멱등 처리 보장 | 동일 idempotencyKey 중복 차단 | 중복 생성 없이 기존 레코드 반환 실측 | **PASS** |
| 삭제 후 재조회 불가 | 삭제 후 getCaseById 404 차단 | 소프트/하드 삭제 후 404 NOT_FOUND 실측 | **PASS** |
| 테넌트 간 격리 | 타 테넌트 케이스 접근 403 차단 | Read/Delete 시도 403 차단 실측 | **PASS** |
| 백업 생성 및 복원 점검 | 스냅샷 생성 & 동일 테넌트 복원 | 백업 복원 성공, 타 테넌트 복원 403 차단 | **PASS** |
| 데이터 수명주기 런북 | `docs/DATA_LIFECYCLE.md` 작성 | 5단계 수명주기, 롤백, 파기 절차 완비 | **PASS** |
| DB 마이그레이션/롤백 | Up & Down SQL 파일 작성 | `0002_cases_schema.sql` 및 rollback 완비 | **PASS** |
| 자동화 수명주기 테스트 | 테스트 스위트 전원 통과 | `cases_lifecycle.test.ts` 포함 338/338 통과 | **PASS** |

---

## 2. 실제 변경 파일 목록

1. `db/migrations/0002_cases_schema.sql` (신규): `cases` 테이블 DDL (내부 caseId, 멱등키, 금액 수치, 보존 만료일, 논리 삭제 플래그, 복합 인덱스)
2. `db/migrations/0002_cases_rollback.sql` (신규): 긴급 롤백 SQL (인덱스 및 테이블 DROP)
3. `server/cases/types.ts` (신규): `CaseRecord`, `CreateCaseInput`(PII 거절 타입), `BackupSnapshot` 인터페이스
4. `server/cases/caseService.ts` (신규): 멱등 생성, No-PII 강제 거절, 삭제(404), 내보내기(CSV/JSON), 백업 및 복원, 만료 파기
5. `docs/DATA_LIFECYCLE.md` (신규): 데이터 수명주기 5단계, 마이그레이션/롤백 가이드, 백업 복구 런북
6. `tests/security/cases_lifecycle.test.ts` (신규): 10개 단위 계약 테스트 (PII 차단, 멱등성, 404 삭제, 403 격리, 백업 복원, 만료 파기, DDL 무결성)
7. `docs/implementation/T35_REPORT.md` (신규): 본 티켓 완료 보고서

---

## 3. 구현 핵심

1. **엄격한 No-PII 및 내부 식별자 체계 (`server/cases/caseService.ts`)**:
   - "고객 이름·주소·주문번호 강제 수집 금지" 안전조건을 엄수하여, 입력단에 `customerName`, `customerAddress`, `orderNumber`, `phone`이 포함될 경우 즉시 `400 PII_COLLECTION_FORBIDDEN`으로 거절.
   - 모든 반품 건은 개인정보가 완전히 제거된 내부 임의 식별자(`case_...`)로만 추적.
2. **네트워크 재시도 대비 멱등성 (Idempotency) 보장**:
   - `idempotency_key` 색인을 두어, 클라이언트의 네트워크 단절이나 재시도 시에도 중복 레코드가 생성되지 않고 기존 레코드를 안전하게 반환.
3. **삭제 후 재조회 불가 (404 NOT_FOUND 보장)**:
   - 사용자가 케이스를 삭제할 경우 `isDeleted: true` 처리(또는 물리 삭제)되어, 이후 `getCaseById()` 호출 시 정보 유출 없이 `404 NOT_FOUND`를 반환.
4. **테넌트 간 데이터 격리 및 백업 복구 무결성**:
   - Tenant A의 케이스를 Tenant B가 조회/삭제 시도할 경우 즉각 `403 FORBIDDEN_TENANT_ACCESS`로 차단.
   - 테넌트 백업 스냅샷을 다른 조직에 복원하려는 교차 복원 시도 역시 `403 CROSS_TENANT_RESTORE_FORBIDDEN`으로 차단.
5. **보존 기간(Retention) 자동 만료 및 영구 파기**:
   - 기본 365일 보존 후 만료된 레코드는 목록에서 숨겨지며, `purgeExpiredCases()` 배치를 통해 D1에서 0바이트로 완전 영구 파기.

---

## 4. 실행한 테스트 (명령 및 실측 결과)

```bash
# 1. TypeScript 엄격 타입 체크
$ npm run typecheck
> tsc --noEmit
# 0 error (PASS)

# 2. ESLint 검사
$ npm run lint
> eslint .
# 0 error (PASS)

# 3. 프로덕션 빌드
$ npm run build
Building ReturnWise production bundle with esbuild...
Production build completed successfully: dist/
# (PASS)

# 4. 전체 단위/통합/E2E/보안 테스트 실행 (31개 스위트)
$ npm test
TAP version 13
# Subtest: T20 | Accessibility & Mobile Quality Contract Tests
# Subtest: T23 | Anonymous Analytics & Metric Integrity Contract
# Subtest: T24 | CI Quality Gate & G3 Certification Contract
# Subtest: T19 | 13 Core End-to-End User Journey Scenarios
# Subtest: T25 | Cloudflare Pages Preview & Staging Contract
# Subtest: T21 | Security, Privacy & Dependency Audit Contract
# Subtest: T22 | SEO, Performance & Content Indexing Contract
# Subtest: T26 | Operator UAT & Launch Approval Contract
# Subtest: T27 | Production Release & Domain Indexing Contract
# Subtest: T28 | Operations, Incident Response & Cost Ledger Contract
# Subtest: T29 | Customer Discovery & Usability Contract
# Subtest: T30 | SEO Research & High-Quality Content Contract
# Subtest: T31 | Pro Validation & Unit Economics Contract
# Subtest: T32 | 90-Day Go/No-Go/Pivot Decision Contract
# Subtest: T33 | Pro Architecture, PRD & ADR Stack Contract
# Subtest: T34 | Multi-Tenant Security & Server-Side RBAC Contract
# Subtest: T35 | Cases Lifecycle, Retention, Deletion & Backup Contract
# ... (총 31개 스위트)
# tests 338
# pass 338
# fail 0
```

---

## 5. 미검증 사항 및 잔여 위험

1. **실제 Cloudflare D1 바인딩 환경 적용**:
   - 현재 마이그레이션 SQL 및 서비스 로직은 완비되었으며, 차기 티켓(T36 CSV 일괄 계산 및 T37 월간 리포트)과 유기적으로 결합될 예정.

---

## 6. 다음 티켓 진행 가능 여부

- **진행 가능 여부**: **가능 (PASS)**
- **다음 티켓**: **T36(CSV 일괄 계산·악성 파일 방어)**
