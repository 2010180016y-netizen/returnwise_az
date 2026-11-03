# ReturnWise Pro 데이터 수명주기·보존·삭제·백업 런북 (DATA_LIFECYCLE.md)

- **제품명**: ReturnWise Pro (서버 확장 데이터 관리 명세)
- **적용 버전**: v1.0.0 Pro
- **진행 단계**: G6 / 데이터 수명주기 및 안정성 관리
- **최종 판정**: **PASS**

---

## 1. 개요 및 특별 안전조건 엄수

1. **최소 데이터 수집 원칙**:
   ReturnWise Pro는 판매자의 월간 반품 비용 분석에 필요한 **최소한의 재무 수치와 내부 식별자**만을 보존하며, 불필요한 개인정보를 원천 배제합니다.
2. **특별 안전조건 1: 고객 이름·주소·주문번호 강제 수집 금지 (No-PII)**:
   > **경고**: 최종 구매자의 이름, 수령인 주소, 전화번호, 오픈마켓 실 주문번호의 수집 및 저장은 시스템 차원에서 엄격히 금지됩니다.
   > 모든 케이스는 내부 임의 식별자(`case_202611_xxxx`)로만 관리됩니다.
3. **특별 안전조건 2: 삭제 후 재조회 불가 (404 Not Found)**:
   사용자가 삭제한 케이스는 즉시 비활성화되어 조회가 영구 차단되며, 탈퇴 시 데이터베이스와 파일 스토리지에서 0바이트로 완전 파기됩니다.

---

## 2. 데이터 수명주기 5단계 (5-Stage Data Lifecycle)

```text
[1. 수집 & 검증] ──▶ [2. 격리 저장] ──▶ [3. 실무 활용] ──▶ [4. 내보내기/백업] ──▶ [5. 영구 파기]
  No-PII 필터링      Cloudflare D1       월간 손실 대시보드    JSON/CSV 내보내기      365일 만료 파기
  임의 caseId 발급    tenant_id 바인딩     세무 증빙 리포트      테넌트 스냅샷         탈퇴 즉시 0바이트
```

1. **Stage 1: 수집 및 무결성 검증 (Collection & Validation)**
   - API 입력단에서 `customerName`, `customerAddress`, `orderNumber` 감지 시 즉시 400 거절.
   - 네트워크 재시도에 따른 중복 저장을 방지하기 위해 `idempotency_key`를 통한 멱등 처리 보장.
2. **Stage 2: 격리 저장 (Storage & Multi-Tenant Scoping)**
   - 모든 레코드는 호출자의 `tenant_id`에 강제 결속되어 D1에 저장 (`db/migrations/0002_cases_schema.sql`).
   - 복합 인덱스(`idx_cases_tenant_created`)로 고속 격리 쿼리 지원.
3. **Stage 3: 실무 활용 (Operational Use)**
   - 월간 반품 손실 대시보드 및 세무사용 부가세/소득세 반품비 증빙 출력에만 활용.
4. **Stage 4: 내보내기 및 백업 (Export & Backup)**
   - 판매자가 원할 때 언제든 PII가 배제된 깨끗한 CSV/JSON 백업 다운로드 제공.
   - 주간 단위 테넌트별 격리 백업 스냅샷 생성.
5. **Stage 5: 자동 만료 및 영구 파기 (Purge & Right to Erasure)**
   - 보존 기간: 기본 365일 보존 후 `purgeExpiredCases()`를 통해 자동 파기.
   - 회원 탈퇴: `ON DELETE CASCADE`에 의해 해당 테넌트의 모든 케이스, 배치 작업, 결제 내역이 원자적으로 영구 소멸.

---

## 3. 데이터베이스 마이그레이션 및 롤백 가이드

### 3.1 정방향 적용 (Up Migration)
- **파일**: `db/migrations/0002_cases_schema.sql`
- **적용 명령**: `wrangler d1 execute returnwise-db --file=db/migrations/0002_cases_schema.sql`
- **생성 객체**: `cases` 테이블, 3대 인덱스(`idx_cases_tenant_created`, `idx_cases_idempotency`, `idx_cases_retention`).

### 3.2 긴급 롤백 (Down Rollback)
- **파일**: `db/migrations/0002_cases_rollback.sql`
- **실행 명령**: `wrangler d1 execute returnwise-db --file=db/migrations/0002_cases_rollback.sql`
- **동작**: 안전하게 인덱스와 테이블을 드롭하여 마이그레이션 이전 상태로 복구.

---

## 4. 백업 생성 및 복원 점검 (Backup & Disaster Recovery)

- **백업 생성**: `caseService.createBackupSnapshot(session)` 실행 시 해당 테넌트의 활성 데이터만 추출하여 무결성 타임스탬프 스냅샷 생성.
- **복원 점검 (Disaster Recovery Simulation)**:
  - 타 테넌트 백업 스냅샷을 다른 조직에 주입하려는 교차 복원 시도는 `403 CROSS_TENANT_RESTORE_FORBIDDEN`으로 즉각 차단.
  - 동일 테넌트 재난 복원 시 원본 식별자와 수치를 1원의 오차 없이 100% 복원 성공 실측.
