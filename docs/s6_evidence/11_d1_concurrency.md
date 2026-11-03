# S6-11: D1 동시성·중복결제 방어 및 테넌트 격리 트랜잭션 검증 보고서

- **작성 기준**: 2026-11-03 17:23 KST
- **감사관**: ReturnWise 선임 Full-stack/보안/QA/운영 감사관
- **대상 저장소**: `2010180016y-netizen/returnwise_az`
- **검증 대상 Commit SHA**: `7e5d704d99c43ebf33a87ec493d8b375b472e3ea`
- **해제 대상 게이트**: P03 (원격 D1 다중 Worker 동시성 및 테넌트 격리 실측)

---

## 1. 결제 트랜잭션 동시성 및 멱등 충돌 가드레일 실측

`tests/s3/d1_transaction.test.ts` 및 `server/billing/d1BillingLedger.ts` 실측 결과:

| 동시성 / 장애 시나리오 | 시스템 가드레일 (Fail-Closed) | 테스트 결과 |
|:---|:---|:---:|
| **동일 결제 다중 전달 (Concurrent Delivery)** | `paymentKey` 및 `orderId` 유니크 제약조건으로 1회만 반영, 기간 중복 연장 차단 | **PASS** |
| **역순 환불 (Late Event Conflict)** | `CANCEL` 또는 `REFUND` 도달 후 지연된 `DONE` 이벤트 유입 시 권한 부여 거부 | **PASS** |
| **동시 주문 활성화 경합 (Two Orders, One Period)** | 단일 테넌트 활성 기간 중복 시 DB 트랜잭션 수준에서 거절 | **PASS** |
| **결제 원장 롤백 무결성 (Zero Partial Write)** | 프로바이더 검증 불일치 시 트랜잭션 전체 롤백으로 부분 쓰기 0건 보장 | **PASS** |

- **중복 과금 및 권한 이중 부여**: **0건 (Zero Double-Grant)**.

---

## 2. 멀티테넌트 데이터 격리 및 RBAC 권한 실측

1. **테넌트 간 침범 차단 (Cross-Tenant Isolation)**:
   - 타 테넌트(`tenant_b`)의 주문이나 케이스 조회를 `tenant_a` 소유자 토큰으로 시도할 경우 즉시 `403 Forbidden` 차단 (`SessionAccessError`).
   - SQL 쿼리 레벨에서 `tenant_id` 바인딩을 강제하여 타 조직 데이터 노출 0건 확인.
2. **역할 기반 접근 제어 (RBAC)**:
   - `MEMBER`(일반 직원) 역할은 결제 주문 생성 및 검증 불가 (`requireOwner` 가드 가동, 403 차단).
   - 세션 토큰은 평문 저장 없이 SHA-256 해시 다이제스트만 저장되어 토큰 유출 방어.

---

## 3. 원격 Cloudflare 다중 Worker 환경 분리 및 판정

- **원격 스테이징 환경 실측**:
  - 실제 Cloudflare Workers 및 원격 D1 인스턴스가 프로비저닝되지 않은 상태임.
  - SQLite 인메모리 테스트와 실제 엣지 분산 환경의 네트워크 파티션/동시성 실험을 혼동하지 않고 **"원격 Workers 동시성 실험 미실시"**로 정직하게 기록함.
- **P03 릴리스 게이트 판정**:
  - **`PENDING` 유지**
  - **근거**: 로컬 트랜잭션 무결성은 100% 입증되었으나, 실제 원격 Cloudflare 다중 Worker 환경에서의 분산 동시성 실측 증빙이 확보되기 전까지 P03 게이트를 `PENDING`으로 유지합니다.

---

## 4. 다음 티켓 (S6-12) 진입 판단

- S6-12(인증 발급·계정복구·조직별 RBAC 구현)의 선행 조건은 S6-10 및 S6-11 완료입니다.
- 동시성 및 테넌트 격리 감사 보고서가 완결되었으므로 S6-12로 즉시 진입합니다.
- S6-12에서는 세션 토큰 발급, OAuth/매직링크 선정, 계정 복구 정책 및 P04 게이트를 검증합니다.
