# T13 실행 결과 보고서 (T13_REPORT.md)

- **티켓 ID:** T13 (반품 사유·금액 입력 폼)
- **작업 일시:** 2026-11-03 08:24 (Asia/Seoul)
- **실행 환경:** Linux x86_64, Node.js v22.11.0, npm 10.9.0, Git 2.43.0, Wrangler 3.109.2
- **판정:** **PASS**

---

## 1. 읽은 문서 및 선행 조건 확인
- **선행 조건:** T12, T06 완료 (`docs/implementation/T12_REPORT.md` 및 `T06_REPORT.md` PASS 확인 완료)
- **완독 및 분석 문서:**
  - `prompts/00_MASTER_PROMPT.md` (상위 가이드라인)
  - `prompts/T13_반품_사유_금액_입력_폼.md` (현 티켓 지침: reason/marketplace/request 및 KRW 필드를 controlled form으로 구현, 0/empty 구별, 필드별 설명/단위 원/판매자부담 구분, 필수/선택 분리, default example 수동 버튼, help tooltips, validation summary, 모든 필드 label/에러 및 focus 이동, 주문번호·전화·주소·이름 필드 추가 절대 금지)
  - `docs/PRODUCT_SCOPE_LOCK.md` (No-PII 및 $0 인프라 가드레일)

---

## 2. 실제 수정 및 생성 파일
- **신규 생성 파일:**
  - `src/features/calculator/InputForm.tsx`: 반품 상황·귀책·플랫폼 및 필수/선택 KRW 금액 입력 전용 controlled form 컴포넌트
  - `tests/integration/InputForm.test.tsx`: InputForm 구조, 필수/선택 분리, 0원 vs 미입력, 한글 도움말, 법률 게이트, validation summary, No-PII 안전 계약 통합 테스트 (4대 스위트, 10개 테스트)
  - `docs/implementation/T13_REPORT.md`: 본 티켓 최종 검증 보고서
- **수정 파일:**
  - `src/features/calculator/CalculatorPage.tsx`: inline 폼을 `<InputForm ... />` 모듈로 교체 및 통합 연동
  - `tests/unit/calculator_page.test.ts`: InputForm 통합에 맞춘 텍스트 및 FAQ 검증 동기화
  - `scripts/run-tests.mjs`: `.test.tsx` 및 `.spec.tsx` 통합 테스트 러너 자동 검색 지원

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

# 4. 전체 단위·회귀·통합 테스트 실행 (단위 8 suites + 통합 1 suite)
npm test
# 결과: 9 suites, 106 tests PASS (106 pass, 0 fail, 1185ms)

# 5. 프로덕션 번들 빌드 검사
npm run build
# 결과: 번들 생성 성공 (dist/assets/index.js 201KB, index.css 9.4KB)

# 6. 도메인 격리 검사
grep -rn "react" returnwise_az/src/domain/
# 결과: 의존성 0건 확인
```

---

## 4. 계산 / 법률 / 보안 가드레일 검증
1. **특별 안전조건(주문번호·전화·주소·이름 필드 추가 금지) 100% 준수:**
   - 주문 식별값(orderId), 고객 이름(customerName), 전화번호(phone), 배송지 주소(address) 등 PII 관련 입력 필드가 일체 없음을 통합 테스트(`InputForm.test.tsx`)로 실측 검증.
2. **0원과 미입력(Empty)의 엄격한 분리 및 한글 읽기 지원:**
   - `refundAmount`를 제외한 모든 금액 필드는 선택 항목이며 미입력 시 0원으로 자동 계산.
   - 명시적 0원 입력 시 `0원 (명시적 0원 입력)` 도움말 노출, 양수 입력 시 `3만 원`, `1만 5,000원` 등 한글 금액 읽기 도움말을 실시간 렌더링하여 자릿수 오입력 원천 방지.
3. **필수/선택 분리 및 판매자 부담 명시:**
   - 필수 항목: `환급 예정 금액` (빨간 별표 및 `aria-required="true"`).
   - 선택 항목: `[판매자 부담] 회수 운송비` (고객부담 운임 차감 제외 안내 툴팁 탑재), `처리·검수비`, `회수 상품 순가치` (비현금 자산 안내), `수수료 크레딧`, `부분환급액`, `교환원가`, `교환배송비` 명확한 구분.
4. **Validation Summary 에러 배너 및 포커스 이동:**
   - 금액 형식 오류, 최대치(10억 원) 초과, 부분환불액이 전액환불액 초과 시 최상단 `Alert type="error"` 에러 요약 배너 표시.
   - 에러 항목 클릭 시 `fieldRefs.current[key]?.focus()`를 호출하여 해당 입력 필드로 즉시 포커스 이동.
5. **법률 게이트(Fail-closed) 체크박스 연동:**
   - 귀책 사유 미확인 시 전체 대안 추천 차단(L01).
   - 부분환불 3대 합의 요건(소비자 자발적 합의, 마켓 약관 허용, 청약철회권 비침해) 미체크 시 KEEP_PARTIAL 추천 원천 배제(L03, L04, L05).
   - 환불 요청 상태에서 교환 동의 미체크 시 교환 추천 배제(L06).

---

## 5. 테스트 결과 (PASS / FAIL / NOT_RUN)
- **InputForm 통합 및 안전 계약 테스트:** **PASS** (10개 테스트 통과)
- **CalculatorPage 및 단일 페이지 상태 동선 테스트:** **PASS** (8개 테스트 통과)
- **공통 컴포넌트 계약 및 렌더링 단위 테스트:** **PASS** (8개 테스트 통과)
- **G1 종합 회귀 및 성질 테스트:** **PASS** (30개 테스트 통과)
- **대안 비교·순위 로직 단위 테스트:** **PASS** (9개 테스트 통과)
- **옵션 자격/정책 확인 게이트 단위 테스트:** **PASS** (12개 테스트 통과)
- **순수 반품/교환 비용 계산 엔진 단위 테스트:** **PASS** (15개 테스트 통과)
- **금액 파서 및 유효성 검증 단위 테스트:** **PASS** (14개 테스트 통과)
- **프로젝트 스모크 테스트:** **PASS** (1개 테스트 통과)
- **총 106개 테스트 전원 통과 (0 fail, 0 skip)**
- **타입스크립트 strict 검사:** **PASS**
- **ESLint 린트 검사:** **PASS**
- **프로덕션 빌드 검사:** **PASS**

---

## 6. P0 / P1 / P2 잔여 이슈 및 위험
- **P0 (차단 결함):** 없음.
- **P1 (주의 사항):** 다음 티켓 T14(비용 결과 표·비교 시각화)에서 4대 대안 카드와 1원 단위 상세 결과 표의 시각적 위계(1위 최저비용 배지, 차액 델타, 절감액 하이라이트)를 정밀 고도화해야 함.
- **P2 (개선 사항):** 모바일 키패드 대응(금액 필드에 `inputMode="numeric"` 속성 부여).

---

## 7. 다음 티켓 진행 가능 여부 및 근거
- **다음 티켓:** **T14 (비용 결과 표·비교 시각화)**
- **진행 가능 여부:** **진행 가능 (Eligible)**
- **근거:** T13의 목적(사용자가 필수 비용과 문맥을 안전하게 입력함, controlled form, 0/empty 구분, 판매자부담 구분, 필수/선택 분리, 빠른 예시 버튼, 툴팁, validation summary, No-PII 준수, 전체 106건 테스트 전원 통과)을 완벽히 달성함.
- **사용자 수동 승인 필요한 작업:** 단일 티켓 클릭 승인제에 따라, 본 보고서 확인 후 사용자가 [T14 실행] 버튼을 클릭할 때까지 대기.
