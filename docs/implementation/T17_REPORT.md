# T17 구현 완료 보고서: 복사·초기화·예시·비정상 복구

- **티켓 ID**: T17 (복사·초기화·예시·비정상 복구)
- **단계**: G2 / 무료 MVP 또는 사업검증 단계
- **선행 티켓**: T14, T16 (`docs/implementation/T14_REPORT.md` PASS, `docs/implementation/T16_REPORT.md` PASS)
- **최종 판정**: **PASS**

---

## 1. 실제 변경 파일 목록

1. `src/lib/clipboard.ts` (신규): 익명 의사결정 요약 리포트 생성기 및 3단계 클립보드 복사 엔진 (Clipboard API -> execCommand -> 수동 복사 모달 폴백)
2. `src/features/calculator/Actions.tsx` (신규): 빠른 실행 바 (예시 1, 예시 2, 전체 초기화), 익명 리포트 복사 버튼, 수동 복사 모달 다이얼로그, 및 렌더링 크래시 방지 `CalculatorErrorBoundary` 컴포넌트
3. `src/features/calculator/CalculatorPage.tsx` (수정): `Actions` 컨트롤 바 마운트 및 `useCalculatorState`의 `parsedInputs` 파이프라인 결속
4. `src/app/App.tsx` (수정): 루트 렌더링 영역에 `CalculatorErrorBoundary` 안전 래퍼 장착
5. `tests/integration/actions.test.tsx` (신규): 4대 계약(익명 리포트 No-PII, 복사 권한 거절 폴백, URL/쿠키 무유출, ErrorBoundary 비정상 복구) 통합 테스트 7건
6. `docs/implementation/T17_REPORT.md` (신규): 본 검증 완료 보고서

---

## 2. 구현 핵심 및 안전 계약 준수

### 2.1 특별 안전조건: 클립보드 결과에 실 구매자 정보 포함 금지 (No PII)
- `generateAnonymousSummaryReport()` 함수는 생성일시, 판매마켓, 귀책사유, 고객요청, 1위 추천 대안, 4대 대안별 순경제비용/현금지출 대조표 및 법률 주의사항만 정형 텍스트로 생성.
- 주문번호, 고객명, 전화번호, 배송지 주소 등 개인 식별 정보(PII) 키워드 및 패턴 일체 배제(0건) 실측 검증.

### 2.2 다중 계층 클립보드 복사 및 권한 거절 Fallback
- **1계층**: `navigator.clipboard.writeText()` 최신 비동기 API 시도.
- **2계층**: 구형 브라우저 또는 비보안 컨텍스트 시 숨김 임시 `<textarea>` 기반 `document.execCommand('copy')` 시도.
- **3계층 (권한 거절 Fallback)**: 보안 정책으로 스크립트 복사가 전면 차단된 환경에서는 사용자에게 수동 복사 전용 텍스트 모달(`<textarea>` 자동 선택)을 띄워 Ctrl+C / Cmd+C로 즉시 복사 유도.

### 2.3 URL / 쿠키 / 분석 페이로드 노출 금지
- 계산 결과 수치나 입력된 금융 파라미터가 `document.cookie` 또는 `window.location.search`(쿼리스트링)로 유출되지 않음.

### 2.4 전체 초기화 (Full Reset)
- '전체 초기화' 클릭 시 10대 금액 입력 필드와 플래그 상태가 즉시 초기화되어 계산 결과가 화면에서 안전하게 지워짐.

### 2.5 Error Boundary와 안전 복구 메시지
- 컴포넌트 렌더링 중 예기치 못한 런타임 에러 발생 시 앱 전체 화이트아웃 크래시를 방지하고 `CalculatorErrorBoundary`가 안전 배너 노출.
- "기본 상태로 안전 복구" 버튼을 통해 상태를 깨끗이 초기화하고 정상 복원 가능.

---

## 3. 실행한 테스트 및 실측 증빙

```bash
$ export PATH="/workspace/.local/bin:/workspace/.local/node/bin:$PATH" && export NODE_OPTIONS="--disable-wasm-trap-handler"
$ cd returnwise_az
$ npm test
# tests 134
# suites 61
# pass 134
# fail 0
# duration_ms 1751.215614

$ npm run typecheck
> tsc --noEmit (0 error PASS)

$ npm run lint
> eslint . (0 error PASS)

$ npm run build
Production build completed successfully: dist/ (assets/index.js 234KB, assets/index.css 9.4KB)

$ grep -rn "react" src/domain/ || echo "NO_REACT_IN_DOMAIN"
NO_REACT_IN_DOMAIN
```

---

## 4. 미검증 및 잔여 위험

- **P0 위험 0건**: No-PII 클립보드 리포트, 다중 계층 복사 폴백, URL/쿠키 무유출, 초기화, ErrorBoundary 안전 복구, 순수 도메인 격리 100% 검증 완료.
- **콘텐츠 및 운영자 고지**: T18 티켓에서 FAQ 최소 8개, 약관 초안, 법률 비자문 고지, 미확인 문구 REVIEW_REQUIRED 라벨링을 통해 완결 예정.

---

## 5. 다음 티켓 진행 가능 여부

- **진행 가능**: 선행 조건(T12, T02)이 이미 완료되어 있으므로, G2 UI 단계의 신뢰성 및 고지 모듈인 **T18(FAQ·고지·운영자 표시 페이지)** 티켓으로 즉시 전진 가능합니다.
