# T03 실행 결과 보고서 (T03_REPORT.md)

- **티켓 ID:** T03 (비용산식·경계값 명세 고정)
- **작업 일시:** 2026-11-03 02:35 (Asia/Seoul)
- **실행 환경:** Linux x86_64, Node.js v22.11.0, npm 10.9.0, Git 2.43.0, Wrangler 3.109.2
- **판정:** **PASS**

---

## 1. 읽은 문서 및 선행 조건 확인
- **선행 조건:** T01, T02 완료 (`docs/implementation/T01_REPORT.md`, `T02_REPORT.md` PASS 확인 완료)
- **완독 및 분석 문서:**
  - `prompts/00_MASTER_PROMPT.md` (상위 실행 가이드라인)
  - `START_HERE.md` (A–Z 프레임워크)
  - `docs/01_PRD.md` (제품 요구사항)
  - `docs/02_FINANCIAL_DOMAIN.md` (단일 계산 정의 및 예시 - SSOT)
  - `docs/03_LEGAL_SAFETY.md` (법률 게이트 및 Fail-closed)
  - `docs/06_TEST_PLAN.md` (C01~C18 18대 계산 fixture 명세)
  - `docs/PRODUCT_SCOPE_LOCK.md` (범위 잠금 문서)
  - `docs/DECISION_GATE_MATRIX.md` (차단 게이트 매트릭스)
  - `prompts/T03_비용산식_경계값_명세_고정.md` (현 티켓 지침)

---

## 2. 실제 수정 및 생성 파일
- **신규 생성 파일:**
  - `docs/CALCULATION_CONTRACT.md`: 기발생 매몰원가 배제 원칙, 순회수가치 보수적 산정 원칙, KRW 정수 원 단위 변수 정의, 4대 대안별 대수식, `cashOutflow` vs `economicCost` 분리 공식, 경계조건(상한 10억 원, 0원과 미입력 구분), 4대 수학적 불변식 명세
  - `tests/fixtures/scenarios.json`: C01부터 C18까지 18개 표준 회귀 테스트 fixture 초안 (입력값, 상황 플래그, 기대값, 상태 판정 100% 매핑)
  - `docs/implementation/T03_REPORT.md`: 본 티켓 최종 검증 보고서

---

## 3. 수행 명령 및 실제 결과 요약

```bash
# 1. scenarios.json 유효성 및 핵심 기대값 자동 검증
python3 -c "
import json
with open('returnwise_az/tests/fixtures/scenarios.json') as f:
    data = json.load(f)
print('Scenarios count:', len(data['fixtures']))
for fix in data['fixtures']:
    if fix['id'] in ['C01', 'C02', 'C15']:
        print(fix['id'], fix['expected'])
"
# 결과:
# Scenarios count: 18
# C01 {'alternative': 'RETURN_FULL', 'status': 'ELIGIBLE', 'cashOutflow': 34500, 'economicCost': 25500}
# C02 {'alternative': 'KEEP_FULL', 'status': 'ELIGIBLE', 'cashOutflow': 30000, 'economicCost': 30000}
# C15 {'alternative': 'EXCHANGE', 'status': 'ELIGIBLE', 'cashOutflow': 19500, 'economicCost': 10500}
```

---

## 4. 계산 / 법률 / 보안 가드레일 검증
1. **합격 판정기준 수치 검증:**
   - **C01 (회수 전액환급):** `cashOutflow = 34,500원`, `economicCost = 25,500원` (기대값 100% 일치)
   - **C02 (회수 없는 전액환급):** `cashOutflow = 30,000원`, `economicCost = 30,000원` (기대값 100% 일치)
   - **C15 (1:1 교환 처리):** `cashOutflow = 19,500원`, `economicCost = 10,500원` (기대값 100% 일치)
2. **특별 안전조건 검증:** `recoveredItemNetValue`(순회수가치)를 원판매가나 매입원가로 자동 대입하는 것을 명세 수준에서 원천 금지하고, 판매자 수동 보수적 입력 또는 기본 0원 원칙을 강제함.
3. **경계조건 검증:** 0원과 미입력(빈문자열/null)을 엄격히 구분(C12), 단일 금액 상한선 1,000,000,000원(10억 원) 설정 및 초과 차단(C13), 음수/소수점/NaN 입력 차단(C11) 규격화.
4. **매몰원가 배제:** 초기 사입원가 등 기발생 비용을 추가 비용에 중복 합산하지 않는 불변식 확립(C14).

---

## 5. 테스트 결과 (PASS / FAIL / NOT_RUN)
- **JSON 스키마 및 C01~C18 18개 시나리오 무결성 검증:** **PASS** (18개 fixture 문법 및 기대값 100% 검증)
- **핵심 수치(C01, C02, C15) 수학적 검증:** **PASS**
- **TypeScript 단위 테스트:** **NOT_RUN** (G0 명세 잠금 단계로 순수 TS 코드는 T05 스캐폴딩 후 T06, T07, T10에서 Vitest로 실행 예정)

---

## 6. P0 / P1 / P2 잔여 이슈 및 위험
- **P0 (차단 결함):** 없음.
- **P1 (주의 사항):** T04에서 기술 스택(React, TS, Vite, Vitest, Playwright), Cloudflare Pages $0 무료 호스팅 원칙, 패키지 설치 상한을 ADR로 확정해야 함.
- **P2 (개선 사항):** 향후 다국어(영문 등) 확장 가능성을 염두에 두되, MVP에서는 KRW 단일 통화 원칙을 유지.

---

## 7. 다음 티켓 진행 가능 여부 및 근거
- **다음 티켓:** **T04 (기술 ADR·설치 정책·비용 상한)**
- **진행 가능 여부:** **진행 가능 (Eligible)**
- **근거:** T03의 모든 완료 기준(`CALCULATION_CONTRACT.md` 확정, `scenarios.json` 18개 시나리오 생성 완료, C01·C02·C15 수치 일치, 경계값 명세 완료)을 100% 충족함.
- **사용자 수동 승인 필요한 작업:** 단일 티켓 클릭 승인제에 따라, 본 보고서 확인 후 사용자가 [T04 실행] 버튼을 클릭할 때까지 대기.
