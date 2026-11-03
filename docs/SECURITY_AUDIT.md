# ReturnWise 보안·개인정보·의존성 종합 감사 보고서 (SECURITY_AUDIT.md)

- **감사 대상 프로젝트**: ReturnWise (한국 소규모 판매자를 위한 반품·교환 비용 비교 계산기)
- **감사 일자**: 2026-11-03
- **감사 기준**: G3 품질 게이트 (무료 MVP 보안 및 프라이버시 기준), 2026 개정 전자상거래법, 개인정보보호법
- **감사 책임자**: ReturnWise 구현 책임 에이전트
- **종합 판정**: **PASS** (High/Critical 취약점 0건, 입력값 외부 전송 0건, PII 0건, 콘솔 민감정보 0건, CSP 충돌 0건)

---

## 1. 감사 요약 (Executive Summary)

ReturnWise는 소규모 이커머스 판매자가 민감한 판매 금액, 원가, 마진, 환급액을 입력하여 반품/교환 처리 방식을 비교하는 **금융·운영 유틸리티 도구**입니다.
본 감사는 사용자의 금전 정보와 브라우저 환경을 완벽하게 보호하기 위해 **Zero-Trust Client-Side Architecture**를 검증했습니다:

1. **알려진 의존성 취약점**: High 0건, Critical 0건 (프로덕션 런타임 취약점 0건).
2. **네트워크 외부 전송**: 0건 (서버 백엔드 없음, 외부 API 호출 부재, CSP `connect-src 'none'` 강제).
3. **개인 식별 정보(PII)**: 입력 필드 및 스키마 내 주문번호, 고객명, 연락처, 주소 0건.
4. **로컬 스토리지 프라이버시**: 자동 저장 기본값 OFF, 명시적 동의 시에만 비민감 운영 기본값 4종 저장, 90일 TTL 자동 파기 및 1클릭 즉시 삭제 지원.
5. **서드파티 트래커 및 스크립트**: Google Analytics, Tag Manager, Meta Pixel, Hotjar 등 서드파티 스크립트 일체 탑재 금지 (특별 안전조건 엄수).
6. **HTTP 보안 응답 헤더**: Cloudflare Pages `public/_headers`에 CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy 선언 완료.

---

## 2. 의존성 보안 점검 (Dependency Security Audit)

### 2.1 감사 수행 절차 및 조치 내역
- 미사용 패키지 `vitest` 제거: Vitest 종속 `tinypool`(Critical) 및 `@vitest/mocker`(Moderate) 제거 완료.
- `minimatch` 패키지 오버라이드: `@typescript-eslint` 내부의 `minimatch <11.0.1` 서비스 거부 취약점을 `minimatch ^11.0.4` 오버라이드로 패치 완료.
- `vite` 개발 서버 패키지 업그레이드: `vite@6.4.5`로 갱신하여 패스 트래버설 및 미들웨어 관련 고위험 이슈를 완벽 해소.

### 2.2 실측 검증 결과
```bash
$ npm audit --omit=dev
found 0 vulnerabilities

$ npm audit --audit-level=high
# npm audit report
esbuild  <=0.24.2
Severity: moderate
(개발 환경 번들러 로컬 서버 관련 moderate 1건 외 High/Critical 0건)
exit_code: 0
```
- **High / Critical 취약점**: **0건 (합격 기준 100% 충족)**
- **프로덕션 런타임 의존성 취약점**: **0건** (`react@18.3.1`, `react-dom@18.3.1` 무결성 확인)

---

## 3. 네트워크 통신 및 외부 전송 감사 (Zero Outbound Network Audit)

### 3.1 소스코드 네트워크 API 전수 스캔
- `src/` 전체 소스코드 스캔 결과:
  - `fetch()`: 0건
  - `XMLHttpRequest`: 0건
  - `navigator.sendBeacon()`: 0건
  - `WebSocket`: 0건
  - 외부 백엔드 엔드포인트 URL: 0건 (정적 법령 출처 `https://www.law.go.kr` 앵커 링크 외 전무)

### 3.2 브라우저 레벨 네트워크 원천 봉쇄 (CSP `connect-src 'none'`)
- `public/_headers`에 선언된 Content-Security-Policy는 `connect-src 'none'`을 명시합니다.
- 이에 따라 클라이언트 코드에 악의적인 스크립트 주입이 시도되더라도 브라우저 엔진 차원에서 외부 HTTP/WebSocket 연결이 즉시 드롭됩니다.

---

## 4. 개인 식별 정보(PII) 및 비밀정보 노출 감사

### 4.1 PII 입력 및 수집 필드 배제
- 판매자가 고객의 개인정보를 계산기에 입력하는 사고를 방지하기 위해 주문번호, 고객명, 연락처, 배송지 주소, 결제카드 번호 등 PII 필드를 UI 및 도메인 인터페이스에서 100% 배제했습니다.
- 입력값은 오직 익명의 통화 금액(KRW 정수) 및 일반화된 사유 분류(단순변심, 표시상이 등)로만 한정됩니다.

### 4.2 하드코딩된 비밀정보 스캔
- 코드베이스 전수 정규식 스캔 결과:
  - AWS 키(`AKIA...`), GitHub 토큰(`ghp_...`), JWT(`Bearer ...`), Private Key 등 기밀정보 0건.
  - `.env.example`에 명시된 바와 같이, 무료 MVP는 외부 유료 API나 백엔드 서버가 없어 비밀키를 보유하지 않습니다.

---

## 5. 로컬 스토리지 최소 저장 및 프라이버시 감사 (Storage Privacy)

### 5.1 스토리지 정책 원칙
1. **Auto-save Default OFF**: 사용자가 STEP 2 하단의 체크박스(`기본값 저장 동의`)를 명시적으로 클릭하지 않는 한 `localStorage`에 일체 쓰지 않습니다.
2. **Non-Sensitive Defaults Only**: 개별 반품 건의 `refundAmount`(환급액), `agreedPartialRefund`(부분환급 합의액) 등 거래 고유값 저장을 원천 차단하고, 판매자의 고정 운영비 4종(`reverseShippingSellerCost`, `handlingCost`, `replacementOutboundShipping`, `platform`)만 선별 저장합니다.
3. **TTL (Time-To-Live)**: 저장일로부터 90일 경과 시 `loadSavedDefaults()`에서 만료로 판정하여 자동 파기합니다.
4. **즉시 영구 삭제**: 사용자가 `저장값 삭제` 버튼을 누르면 `rw_seller_defaults_v1` 키가 브라우저에서 즉시 제거됩니다.
5. **무장애 안전 폴백**: 시크릿 브라우징이나 스토리지 차단 환경에서도 앱이 중단되지 않고 인메모리 연산으로 정상 동작합니다.

---

## 6. XSS 및 출력 인코딩 감사 (XSS & Injection Defense)

1. **React JSX 안전 인코딩**: 모든 텍스트 및 숫자 렌더링은 React의 기본 텍스트 노드 이스케이프를 거칩니다.
2. **위험 API 전무**: 소스코드 내 `dangerouslySetInnerHTML`, `.innerHTML`, `eval()` 사용 0건 실측.
3. **CSP 차단 가드**: CSP `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`를 통해 플러그인 주입 및 폼 하이재킹을 차단했습니다.

---

## 7. HTTP 보안 응답 헤더 및 CSP 감사 (`public/_headers`)

Cloudflare Pages 정적 호스팅 환경에 배포되는 `public/_headers` 설정은 다음과 같습니다:

```http
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; block-all-mixed-content;

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: public, max-age=0, must-revalidate
```

### 각 지시문별 보호 효과
- `X-Content-Type-Options: nosniff`: 브라우저의 악의적인 MIME 타입 스니핑 실행 방지.
- `X-Frame-Options: DENY` & `frame-ancestors 'none'`: 타 사이트의 iframe 삽입 및 Clickjacking 공격 차단.
- `Permissions-Policy`: 불필요한 카메라, 마이크, 위치정보, 결제 API 접근을 브라우저 차원에서 차단.
- `Strict-Transport-Security`: 1년간 HTTPS 통신 강제 및 프리로드 등록 지원.
- `connect-src 'none'`: 클라이언트 런타임의 외부 통신 시도를 완벽 차단.

---

## 8. 소스맵 및 스택 트레이스 정책 (Source Map Policy)

- **프로덕션 빌드 스크립트(`scripts/build.mjs`)**: `sourcemap: false` 고정.
- **번들 결과물(`dist/assets/`)**: `.map` 파일 0건 생성 확인.
- **런타임 에러 경계(`CalculatorErrorBoundary`)**: 사용자 화면에 원시 소스코드 스택 트레이스나 내부 파일 경로를 노출하지 않고, 사용자 친화적 복구 배너 및 재시도 버튼만 표시.

---

## 9. 서드파티 애널리틱스 및 외부 스크립트 금지 점검 (특별 안전조건)

- **특별 안전조건 규정**: "민감값을 포함한 서드파티 analytics 자동 도입 금지."
- **실측 점검 결과**:
  - `index.html`: Google Analytics(`gtag`), GTM, Meta Pixel, Hotjar 등 트래커 태그 0건.
  - `src/`: 원격 로깅 또는 원격 계측 라이브러리 0건.
  - 사용자가 입력한 반품 금액, 원가, 마켓 정보는 제3자 데이터 플랫폼으로 유출될 수 있는 통로가 일체 존재하지 않습니다.

---

## 10. 공개 고지 문구 및 프라이버시 방침 일치성 점검

`src/content/disclosures.ts`에 명시된 정책과 실제 코드 동작의 일치성을 검증했습니다:

| 고지 항목 | 방침 기재 내용 | 실제 구현 및 검증 결과 | 일치 여부 |
|---|---|---|---|
| PII 미수집 | 주문번호, 성명, 연락처 등 일체 미입력/미수집 | 입력 폼 및 도메인 인터페이스 내 PII 필드 0건 | **일치 (PASS)** |
| 100% 로컬 연산 | 브라우저 JS 메모리에서만 동작, 외부 전송 없음 | 네트워크 API 0건, CSP `connect-src 'none'` | **일치 (PASS)** |
| 선택적 저장 | 사용자 동의 시에만 비민감 4종 저장, 90일 만료 | `saveDefaults` 동의 검증, `sanitizeDefaults` | **일치 (PASS)** |
| 트래커 미사용 | 제3자 광고 추적기 및 행동 분석 쿠키 일체 미탑재 | `index.html` 및 번들 내 트래커 0건 | **일치 (PASS)** |
| 법률 비자문 고지 | 변호사법/세무사법 비자문 명시 | `LEGAL_DISCLAIMER_TEXT` 메인 화면 노출 | **일치 (PASS)** |
| 운영자 정보 | 실제 법인 부재 시 임의 날조 금지 | `OPERATOR_DISCLOSURE.status === 'REVIEW_REQUIRED'` | **일치 (PASS)** |

---

## 11. 자동화 테스트 증빙

```bash
$ export PATH="/workspace/.local/bin:/workspace/.local/node/bin:$PATH" && export NODE_OPTIONS="--disable-wasm-trap-handler"
$ cd returnwise_az
$ npm test
# Subtest: T21 | Security, Privacy & Dependency Audit Contract
# tests 187
# pass 187
# fail 0
```
`tests/e2e/privacy.spec.ts` 17개 단위 보안 계약을 포함하여 총 17개 스위트, 187개 테스트 전원 통과 실측.

---

## 12. 잔여 위험 및 다음 티켓 진행 권고

1. **잔여 위험 (Low)**: `esbuild <=0.24.2` 로컬 개발 서버 관련 Moderate 취약점 1건은 프로덕션 배포 번들(`dist/`)에 포함되지 않는 로컬 빌드 도구 고유 이슈로서, 향후 빌더 메이저 버전 안정화 시 갱신 권장.
2. **운영자 사업자 정보**: `docs/PUBLIC_COPY_REVIEW.md` 및 `src/content/disclosures.ts`에 정의된 `[사람 승인 대기]` 상태는 프로덕션 실 도메인 출시(T26/T27) 시 실제 사업자 정보로 최종 교체 및 사람 승인이 필요함.
3. **다음 티켓 진행 가능 여부**: **T22(검색 노출·기본 성능·콘텐츠 색인) 진행 가능 (PASS)**.
