# ADR 0002: 도메인 로직 격리 및 순수 함수 아키텍처

- **상태:** ACCEPTED (G0 설계 잠금)
- **결정일자:** 2026-11-03 (Asia/Seoul)
- **티켓:** T04 (기술 ADR·설치 정책·비용 상한)
- **적용 범위:** `src/domain/` 및 전체 계산/안전 엔진

---

## 1. 맥락 및 배경 (Context)
ReturnWise의 핵심 비즈니스 가치는 1원 단위의 정확한 비용 계산(C01~C18)과 법률/마켓 규정에 따른 엄격한 추천 차단 게이트(L01~L08)에 있다.  
만약 비즈니스 계산 로직이 React 컴포넌트 내부(Hooks, State, DOM 이벤트)에 결합되면 다음과 같은 심각한 문제가 발생한다:
1. 브라우저 렌더링 사이클에 따라 계산 결과가 왜곡되거나 재현 불가능해질 위험.
2. 프레임워크나 UI 라이브러리가 변경될 때 핵심 금융 계산식이 오염될 위험.
3. Vitest 등 테스트 환경에서 브라우저 DOM 모킹 없이 초고속으로 수천 회 회귀 테스트를 수행하기 어려움.

---

## 2. 의사결정 내용 (Decision)

### 2.1 도메인 계층의 완전 격리 (`src/domain/`)
- `src/domain/` 내의 모든 모듈은 **React, DOM, `window`, `document`, `localStorage`, `fetch`, 외부 라이브러리를 일체 import하지 않는 100% 순수 TypeScript 모듈**로 작성한다.
- 도메인 내부 구조:
  ```
  src/domain/
    ├── types.ts          # Money(KRW 정수), ReturnContext, ScenarioResult 불변 타입
    ├── parser.ts         # 문자열 파싱, 0원 vs 미입력 구분, 10억 상한 검증
    ├── calculator.ts     # 4대 대안별 대수식 계산 순수 함수
    ├── gates.ts          # 소비자 합의 및 마켓 규정 적격성 검증기 (Fail-closed)
    └── comparator.ts     # 적격(ELIGIBLE) 대안 간 순경제적 비용 순위 비교기
  ```

### 2.2 입력 불변성 및 출력 결정성
- 모든 계산 함수는 `(inputs: ReturnInputs, flags: DecisionFlags) => CalculationResult` 형태의 순수 함수로 작성된다.
- 동일한 입력 파라미터가 주어지면 100만 번 실행해도 항상 동일한 바이트 단위 출력을 반환한다(Deterministic).
- 객체 내부 상태를 직접 변경(Mutation)하지 않고 항상 새로운 결과 객체를 반환한다.

### 2.3 스토리지 격리 (`src/lib/storage.ts`)
- `localStorage` 접근은 `src/lib/storage.ts`에 완전 격리한다.
- 저장 허용 범위: 사용자가 명시적으로 동의한 '기본 운송비(예: 3,500원)' 및 '기본 검수비(예: 1,000원)' 단 2개 숫자 필드로 제한한다.
- 개별 반품 건의 금액, 사유, 고객 데이터는 로컬 스토리지에 일체 저장하지 않는다.
- 데이터 스키마 변경에 대비하여 `schemaVersion`을 관리하고, 파싱 실패 시 기본값으로 안전 초기화(Safe Fallback)한다.

---

## 3. 결과 및 효과 (Consequences)
- **긍정적 효과:**
  - 18개 계산 fixture 및 8개 안전 시나리오를 Node 환경에서 브라우저 없이 수 밀리초 만에 100% 검증 가능.
  - UI 렌더링 결함이 발생하더라도 도메인 계산 공식의 무결성은 완전히 보존됨.
  - 향후 CLI 도구, 백엔드 API, 또는 모바일 앱으로 비즈니스 로직을 그대로 이식 가능.
- **수용된 제약:**
  - UI 상태와 도메인 모델 간 변환(Mapping) 코드가 다소 필요함 (ViewModel 패턴 적용).
