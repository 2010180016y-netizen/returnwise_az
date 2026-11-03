# T36 구현 완료 보고서: CSV 일괄 계산·악성 파일 방어

- **티켓 ID**: T36 (CSV 일괄 계산·악성 파일 방어)
- **단계**: G6 / 유료화 엔지니어링 및 배치 처리 단계
- **선행 티켓**: T35, T10 (전원 완료 확인 - PASS)
- **최종 판정**: **PASS**

---

## 1. 판정 요약

| 점검 항목 | 요구 기준 | 실측 결과 | 판정 |
|---|---|---|---|
| 정상 대량 계산 | 100행 / 1,000행 결과 정확도 | 100행(<10ms) & 1,000행(<50ms) 100% 성공 | **PASS** |
| CSV Injection 방어 | 수식 접두어(=, +, -, @ 등) 무력화 | 작은따옴표(') 접두어 처리 및 이스케이프 실측 | **PASS** |
| 파일 크기 및 행수 제한 | 최대 5MB, 최대 1,000행 제한 | 초과 시 즉시 거절 에러 발생 실측 | **PASS** |
| 인코딩 및 한글 처리 | UTF-8 BOM, 한글 헤더 지원 | `\uFEFF` 제거 및 한글 동의어 매핑 완비 | **PASS** |
| PII 업로드 감지/폐기 | 고객 개인정보 경고 및 메모리 폐기 | PII 경고 발령 & rawPiiCleaned 내 PII 0건 실측 | **PASS** |
| 취소 및 동시성 제어 | AbortSignal 기반 진행 취소 | `BATCH_PROCESSING_CANCELLED` 중단 실측 | **PASS** |
| 특별 안전조건 엄수 | 원본 CSV 개인정보 무심코 저장 차단 | 메모리 단계에서 PII 열 즉시 폐기(Drop) | **PASS** |
| 자동화 배치 테스트 | 테스트 스위트 전원 통과 | `csv_batch.test.ts` 포함 348/348 통과 | **PASS** |

---

## 2. 실제 변경 파일 목록

1. `src/features/batch/types.ts` (신규): `BatchRowInput`, `BatchRowResult`, `BatchValidationSummary`, `BatchProcessingOptions` 인터페이스
2. `src/features/batch/csvParser.ts` (신규): CSV 파서, PII 헤더 감지, 5MB 및 1,000행 한도 강제, PII 메모리 즉시 폐기, UTF-8 BOM 처리
3. `server/batch/csvSanitizer.ts` (신규): CSV Formula Injection 살균기 (DDE 트리거 문자 접두어 `'` 무력화, CSV 직렬화)
4. `server/batch/batchProcessor.ts` (신규): 서버측 일괄 계산 실행기 (`calculateAllAlternatives` 결속), AbortSignal 취소, 안전한 내보내기 CSV 생성
5. `tests/batch/csv_batch.test.ts` (신규): 10개 단위 계약 테스트 (100행/1000행 속도 및 정확도, 수식 주입 방어, 파일/행수 한도, PII 폐기, BOM, 취소)
6. `docs/implementation/T36_REPORT.md` (신규): 본 티켓 완료 보고서

---

## 3. 구현 핵심

1. **초고속 대량 계산 및 도메인 연동 (`server/batch/batchProcessor.ts`)**:
   - G1에서 검증된 순수 금융 계산 엔진(`calculateAllAlternatives`)을 직결.
   - 100행 4ms, 1,000행 20ms 수준의 초고속 계산 성능 실측 (기준치 500ms 대폭 상회).
   - AbortController `signal`을 청크 단위로 검사하여 사용자의 '진행 취소' 시 불필요한 연산 즉시 중단.
2. **CSV Injection (Formula Injection) 원천 무력화 (`server/batch/csvSanitizer.ts`)**:
   - 엑셀, 스프레드시트 DDE 수식 실행을 유발하는 6대 위험 접두어(`=`, `+`, `-`, `@`, `\t`, `\r`)로 시작하는 셀 값에 자동으로 작은따옴표(`'`)를 붙여 단순 문자열로 치환.
3. **엄격한 PII 감지 및 메모리 단계 폐기 (특별 안전조건 준수)**:
   - "반품 주문 원본 CSV의 개인정보를 무심코 저장하지 않게 설계" 안전조건을 완벽히 엄수.
   - `고객명`, `수령인주소`, `전화번호`, `주문번호` 등의 열이 업로드되면 `piiWarning: true` 및 경고 목록을 반환함과 동시에, 가공 데이터 객체에서 해당 열을 즉시 제거(Drop)하여 D1 데이터베이스나 R2 스토리지에 개인정보가 단 1바이트도 저장되지 않도록 기술적 잠금.
4. **용량 및 행 수 한도 통제**:
   - 5MB 초과 파일 및 1,000행 초과 데이터는 파싱 시작 전에 즉시 차단하여 DoS 공격 및 메모리 오버플로우 방어.
   - UTF-8 BOM(`\uFEFF`) 바이트를 자동으로 감지 및 제거하여 한글 깨짐 방지.

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

# 4. 전체 단위/통합/E2E/보안/배치 테스트 실행 (32개 스위트)
$ npm test
TAP version 13
# Subtest: T36 | CSV Batch Calculation & Security Contract
#   - 100행 정상 계산 성공 (4.0ms)
#   - 1,000행 대용량 계산 성공 (19.4ms)
#   - 악성 수식 접두어(=, +, -, @ 등) 중화 성공
#   - PII 컬럼 경고 및 메모리 폐기 0건 보존 검증
#   - 1000행 초과 및 5MB 초과 거절 검증
#   - UTF-8 BOM 및 AbortSignal 취소 검증
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
# ... (총 32개 스위트)
# tests 348
# pass 348
# fail 0
```

---

## 5. 미검증 사항 및 잔여 위험

1. **브라우저 웹 워커(Web Worker) UI 연동**:
   - 현재 파서, 살균기, 계산 엔진은 완비되었으며, 차기 티켓(T37 월간 리포트)과 연동하여 최종 대시보드 리포팅으로 완성될 예정.

---

## 6. 다음 티켓 진행 가능 여부

- **진행 가능 여부**: **가능 (PASS)**
- **다음 티켓**: **T37(월간 리포트·사용량 제한)**
