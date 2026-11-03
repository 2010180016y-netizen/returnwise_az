# T09 실행 결과 보고서 (T09_REPORT.md)

- **티켓 ID:** T09 (대안 비교·순위 로직)
- **작업 일시:** 2026-11-03 08:12 (Asia/Seoul)
- **실행 환경:** Linux x86_64, Node.js v22.11.0, npm 10.9.0, Git 2.43.0, Wrangler 3.109.2
- **판정:** **PASS**

---

## 1. 읽은 문서 및 선행 조건 확인
- **선행 조건:** T07, T08 완료 (`docs/implementation/T07_REPORT.md`, `T08_REPORT.md` PASS 확인 완료, G1 단계)
- **완독 및 분석 문서:**
  - `prompts/00_MASTER_PROMPT.md` (상위 실행 가이드라인)
  - `docs/01_PRODUCT_PRD.md` & `docs/PRODUCT_SCOPE_LOCK.md` (REQ-P0-03, REQ-P0-04, REQ-P0-05)
  - `docs/DECISION_GATE_MATRIX.md` (Fail-closed Gate Matrix)
  - `docs/CALCULATION_CONTRACT.md` (비용 분리 공식)
  - `prompts/T09_대안_비교_순위_로직.md` (현 티켓 세부 지침)

---

## 2. 실제 수정 및 생성 파일
- **수정 파일:**
  - `src/domain/types.ts`: `RankMetric`, `AlternativeCategory`, `ConfidenceLevel`, `RankedAlternative`, `ComparisonResult` 타입 인터페이스 추가
- **신규 생성 파일:**
  - `src/domain/compare.ts`: 대안 비교·순위 산출 엔진(`compareAlternatives`), 카테고리 분리기(`getAlternativeCategory`), 가정문구 생성기(`generateAssumptions`), 신뢰도 평가기(`determineConfidence`) 구현
  - `tests/unit/compare.test.ts`: eligible 0/1/2개별 동작, cash vs economic 지표 분리, 3요건 충족 시 KEEP_PARTIAL 1위, 동점(Tie) 처리, 비적격 차단, 카테고리 분리 단위 테스트 스위트
  - `docs/implementation/T09_REPORT.md`: 본 티켓 최종 검증 보고서

---

## 3. 수행 명령 및 실제 결과 요약

```bash
# 1. PATH 및 환경변수 설정
export PATH="/workspace/.local/bin:/workspace/.local/node/bin:$PATH"
export NODE_OPTIONS="--disable-wasm-trap-handler"

# 2. TypeScript strict 타입 검사
npm run typecheck
# 결과: 에러 0건 PASS

# 3. ESLint 정적 분석 검사
npm run lint
# 결과: 에러 0건 PASS

# 4. 단위 테스트 실행 (compare.test.ts + eligibility.test.ts + calculate.test.ts + money.test.ts + smoke.test.ts)
npm test
# 결과: 5 suites, 51 tests PASS (482ms)

# 5. 프로덕션 번들 빌드 검사
npm run build
# 결과: 번들 생성 성공 (dist/)

# 6. 도메인 격리 검사
grep -rn "react" returnwise_az/src/domain/
# 결과: 의존성 0건 확인
```

---

## 4. 계산 / 법률 / 보안 가드레일 검증
1. **eligible 대안 개수별 정확한 동작 검증:**
   - **eligible 0개 (L01 귀책 불명):** `bestAlternative`는 undefined이며, 모든 대안의 `rank`는 null, `isRecommended`는 false로 설정됨.
   - **eligible 1개 (유일 적격 대안):** 단일 적격 대안에 `rank: 1`이 부여되나, 비교 대안이 없으므로 `isRecommended: false`, `deltaVsBest: 0`으로 차액 미표시.
   - **eligible >= 2개 (다중 대안 비교):** 1위 최저비용 대안에 `isRecommended: true` 배지가 부여되고, 2위 이하 대안들에 대해 1위 대비 추가 비용(`deltaVsBest`) 및 기준안 대비 절감액(`savingsIfChosen`)이 1원 단위로 정확히 계산됨.
2. **현금(cashOutflow) vs 경제적(economicCost) 지표 완전 분리:**
   - `ECONOMIC_COST` 탭: 회수상품 순가치(9,000원)가 차감되어 `RETURN_FULL`(25,500원)이 1위 선정.
   - `CASH_OUTFLOW` 탭: 순수 현금 유출만 비교되어 `KEEP_FULL`(30,000원)이 `RETURN_FULL`(34,500원)을 제치고 1위로 역전 선정됨을 실측. 두 지표의 혼용 착시 원천 방지.
3. **비적격 대안 강조 금지 특별 안전조건:**
   - 고객이 환불을 요청한 상태(`buyerRequest === 'REFUND'`)에서 고객 교환 미동의 시 `EXCHANGE` 대안은 `rankingEligible: false`, `rank: null`, `isRecommended: false`, `deltaVsBest: null`로 격리되어 UI에서 회색 카드로 표시될 수는 있어도 절대 추천 배지를 받을 수 없도록 보장.
4. **결정론적 동점(Tie) 처리:**
   - 지표값이 동일한 경우 `isTie: true` 플래그가 자동 부착되며, 보조 지표 대조 후 대안 코드 알파벳 순으로 안정 정렬됨.
5. **환불군과 교환군 분리:**
   - `refundGroup` (3개 대안)과 `exchangeGroup` (1개 대안)으로 카테고리를 명확히 분리하여 성격이 다른 거래 방식을 사용자에게 구분하여 안내.

---

## 5. 테스트 결과 (PASS / FAIL / NOT_RUN)
- **대안 비교·순위 로직 단위 테스트:** **PASS** (9개 테스트 통과)
- **옵션 자격/정책 확인 게이트 단위 테스트:** **PASS** (12개 테스트 통과)
- **순수 반품/교환 비용 계산 엔진 단위 테스트:** **PASS** (15개 테스트 통과)
- **금액 파서 및 유효성 검증 단위 테스트:** **PASS** (14개 테스트 통과)
- **프로젝트 스모크 테스트:** **PASS** (1개 테스트 통과)
- **타입스크립트 strict 검사:** **PASS**
- **ESLint 린트 검사:** **PASS**
- **프로덕션 빌드 검사:** **PASS**

---

## 6. P0 / P1 / P2 잔여 이슈 및 위험
- **P0 (차단 결함):** 없음.
- **P1 (주의 사항):** 다음 티켓 T10은 G1 단계의 최종 종합 심사 티켓으로, 18대 계산 fixture(C01~C18)와 8대 안전 게이트(L01~L08) 전수를 파이프라인 레벨에서 회귀 테스트하고 G1 심사 기준을 판정해야 함.
- **P2 (개선 사항):** UI 단계(T14)에서 `RankMetric` 탭 전환 버튼('순경제비용 기준' vs '현금 지출 기준')을 탭 형태로 매끄럽게 연결.

---

## 7. 다음 티켓 진행 가능 여부 및 근거
- **다음 티켓:** **T10 (계산 회귀·성질 테스트 및 G1 심사)**
- **진행 가능 여부:** **진행 가능 (Eligible)**
- **근거:** T09의 모든 요구사항(eligible 0/1/2개 동작, cash vs economic selector 지원, 동점 처리, 환불/교환 그룹 분리, 누락 비용 가정 및 신뢰도 산출, 불허 옵션 추천 배제 가드레일, 도메인 격리)을 완벽히 충족함.
- **사용자 수동 승인 필요한 작업:** 단일 티켓 클릭 승인제에 따라, 본 보고서 확인 후 사용자가 [T10 실행] 버튼을 클릭할 때까지 대기.
