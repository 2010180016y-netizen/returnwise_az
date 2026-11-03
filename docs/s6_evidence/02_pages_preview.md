# S6-02: 격리 Cloudflare Pages 프리뷰 실측 및 정적 보안 헤더 검증 보고서

- **작성 기준**: 2026-11-03 17:00 KST
- **감사관**: ReturnWise 선임 Full-stack/보안/QA/운영 감사관
- **대상 저장소**: `2010180016y-netizen/returnwise_az`
- **검증 대상 Commit SHA**: `7e5d704d99c43ebf33a87ec493d8b375b472e3ea`
- **해제 대상 게이트**: F07 (Cloudflare Pages 프리뷰 실측 및 무단 배포 차단)

---

## 1. Cloudflare 원격 계정 및 리소스 실측 사실

- **Cloudflare Pages 프로젝트 실측**: **0개** (원격 프로젝트 부재 확인)
- **Cloudflare D1 데이터베이스 실측**: **0개** (원격 DB 부재 확인)
- **원격 도메인 연결**: 없음 (미연결)
- **판정 및 F07 게이트 상태**:
  - 원격 프리뷰 환경이 계정에 아직 프로비저닝되지 않았으므로, 가짜 URL이나 날조된 성공 지표를 일체 기록하지 않습니다.
  - **F07 게이트 상태는 엄격하게 `BLOCKED`를 유지**합니다. (운영자의 명시적 Cloudflare 프로젝트 생성 및 연동 승인 전까지 해제 불가)

---

## 2. 로컬 격리 프리뷰 실측 (`scripts/verify-pages-preview.mjs`)

운영자 승인 전 임의의 원격 배포를 원천 금지하고, 프로덕션 빌드 아티팩트(`dist/`)의 Cloudflare Pages 에뮬레이션 정적 서버 루프를 통해 실제 HTTP 요청/응답 헤더를 전수 실측했습니다.

### 2.1 실측 요청/응답 매트릭스

| 요청 경로 | 예상 | 실제 HTTP 상태 | 핵심 검증 헤더 및 페이로드 | 판정 |
|:---|:---:|:---:|:---|:---:|
| `/` | 200 | **200 OK** | `Content-Security-Policy: connect-src 'none'`<br>`X-Content-Type-Options: nosniff`<br>`Cache-Control: public, max-age=0, must-revalidate` | **PASS** |
| `/assets/index.js` | 200 | **200 OK** | `Content-Type: application/javascript; charset=utf-8`<br>`Cache-Control: must-revalidate` (immutable 없음) | **PASS** |
| `/assets/index.css` | 200 | **200 OK** | `Content-Type: text/css; charset=utf-8`<br>`Cache-Control: must-revalidate` | **PASS** |
| `/calculator` | 301 | **301 Moved** | `Location: /` (`_redirects` 규칙 정상 적용) | **PASS** |
| `/nonexistent-route` | 404 | **404 Not Found** | `X-Robots-Tag: noindex, nofollow`<br>`404.html` 안내 문구 및 메인 복귀 링크 렌더 | **PASS** |

### 2.2 보안 격리 및 외부 연결 차단 실측
- **CSP connect-src none**: 브라우저 런타임에서 서드파티 트래커, 외부 API, 무단 원격 호출 경로 0건 강제.
- **비밀값 및 환경변수 0건**: `.env` 파일 부재 및 번들 내 API Key/Secret 0건 실측.
- **Pro/PG/D1 완전 격리**: 무료 정적 계산기 모드에서 D1 Worker, 토스페이먼츠 SDK, 유료 세션 호출이 일체 발생하지 않음.

---

## 3. 재현 검증 스크립트 구축

- **실행 명령**: `node --disable-wasm-trap-handler scripts/verify-pages-preview.mjs`
- **기능**:
  - `dist/_headers` 파싱 후 라우트별 헤더 주입
  - `dist/_redirects` 301 리다이렉트 엔진 작동
  - 404 noindex 및 보안 헤더 자동 검증

---

## 4. 릴리스 게이트 상태 및 잔여 블로커

| 게이트 ID | 영역 | 현재 상태 | 사유 및 잔여 작업 |
|:---:|:---:|:---:|:---|
| **F01** | 공통 | **PASS** | S6-01에서 PR #1~#6 병합 실측 확인 |
| **F02** | 공통 | **PASS** | S6-01에서 통합 main CI (`41597679544`) 485개 테스트 통과 확인 |
| **F07** | 무료 P0 | **BLOCKED** | Cloudflare Pages 원격 프로젝트 0개. 원격 배포는 운영자 명시 승인 전까지 대기 |
| **F03~F06, F08~F09** | 무료 P0 | **PENDING** | 법률 출처 검증(S6-03), 고지 실체화(S6-04), 실기기 UAT(S6-05) 등 대기 |

---

## 5. 다음 티켓 (S6-03) 진입 판단

- S6-03(법률·플랫폼 정책 출처 검증)의 선행 조건은 S6-01이므로 즉시 진입 가능합니다.
- S6-03에서는 전자상거래법 제17조, 제18조, 공정위 고시, 네이버/쿠팡 반품 약관 출처 실측을 집행합니다.
