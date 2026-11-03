# ReturnWise Cloudflare Pages 배포 및 프리뷰 가이드 (PAGES_DEPLOYMENT.md)

- **문서 목적**: Cloudflare Pages Git 연동 및 프리뷰(Staging) 환경 구축, 무중단 배포 표준 명세
- **대상 프로젝트**: ReturnWise (반품·환불·교환 비용 비교 계산기)
- **적용 단계**: G4 / 무료 MVP 배포 및 검증 단계
- **최종 상태**: **준비 완료 (Ready for Review)**

---

## 1. 아키텍처 및 비용 원칙

1. **$0 무자본 인프라 (ADR-01 준수)**: Cloudflare Pages Free Tier 활용 (월 500회 빌드, 무제한 대역폭, 100개 커스텀 도메인 무료).
2. **Zero Environment Variables**: 백엔드 API, 외부 데이터베이스, 유료 인증키가 없으므로 Cloudflare 대시보드 내 **환경변수 0건**으로 동작.
3. **특별 안전조건 엄수**: 사람 운영자(회기님)의 명시적 승인 전까지 임의의 원격 푸시, 외부 공개, 유료 결제 설정을 절대 실행하지 않음.

---

## 2. Cloudflare Pages 프로젝트 설정 규격 (Build Configuration)

Cloudflare 대시보드에서 `returnwise` 프로젝트 생성 시 아래 설정을 그대로 적용합니다:

| 설정 항목 | 설정값 | 비고 및 근거 |
|---|---|---|
| **Project Name** | `returnwise` | 기본 URL: `https://returnwise.pages.dev` |
| **Framework Preset** | `None` (Custom) | 경량 독립 esbuild 파이프라인 활용 |
| **Build Command** | `npm run build` | `tsc --noEmit && node scripts/build.mjs` 자동 실행 |
| **Build Output Directory** | `dist` | 번들 JS/CSS, index.html, 404.html, _headers, _redirects 포함 |
| **Root Directory** | `/` (또는 저장소 루트) | `package.json` 위치 |
| **Node.js Version** | `20` | 환경변수 `NODE_VERSION: 20` (선택 사항) |
| **Environment Variables** | **없음 (Empty)** | 순수 클라이언트 정적 번들로 비밀키 불필요 |

---

## 3. 프리뷰(Preview / Staging) 환경 분리 원칙

Cloudflare Pages는 브랜치 기반 프리뷰를 기본 지원합니다:
- **프로덕션 (Production)**: `main` 브랜치에 머지된 커밋 -> `https://returnwise.pages.dev` (또는 커스텀 도메인) 자동 배포.
- **프리뷰 (Preview / Staging)**: Pull Request 또는 개발 브랜치(`feature/*`) -> `https://<commit-hash>.returnwise.pages.dev` 고유 프리뷰 URL 발급.

### 프리뷰 환경 전용 보호 규칙
1. **검색엔진 색인 원천 차단**: Cloudflare Pages 프리뷰 도메인은 기본적으로 `X-Robots-Tag: noindex` 헤더를 주입하여 개발 중인 화면이 구글/네이버에 중복 색인되는 것을 방지.
2. **No Production Impact**: 프리뷰 환경 배포는 프로덕션 실사용자에게 0.01%의 영향도 주지 않음.
3. **동일 보안 헤더 적용**: `public/_headers`의 엄격한 CSP(`connect-src 'none'`), HSTS, nosniff가 프리뷰 도메인에도 100% 동일하게 강제됨.

---

## 4. 라우팅, 404 및 리다이렉트 정책 (`_redirects`, `404.html`)

1. **단일 페이지(SPA) 라우팅**:
   - `index.html`이 루트(`/`)에서 초기 렌더링을 담당.
2. **별칭 리다이렉트 (`public/_redirects`)**:
   - `/calculator`, `/return`, `/refund`, `/exchange` 등 사용자가 직관적으로 입력할 수 있는 URL을 301 영구 리다이렉트로 루트(`/`)에 결속.
3. **커스텀 404 안내 (`public/404.html`)**:
   - 존재하지 않는 경로 접근 시 브랜딩에 맞춘 정적 404 페이지 제공 및 `X-Robots-Tag: noindex, nofollow` 적용.
   - [계산기 메인으로 이동] 원클릭 복구 버튼 제공.

---

## 5. 로컬 정적 프리뷰 검증 방법 (Local Preview Smoke Test)

배포 전 로컬 환경에서 프로덕션 빌드 결과물을 검증하는 명령입니다:

```bash
# 1. 프로덕션 빌드
$ npm run build

# 2. 로컬 정적 웹서버 구동 (포트 4173 등)
$ npx serve dist -l 4173

# 3. 브라우저 접속 및 스모크 테스트
# URL: http://localhost:4173
# - STEP 1 귀책 사유 및 금액 입력 후 계산 결과 즉시 노출 여부
# - 개발자 도구 콘솔 에러 0건 확인
# - 네트워크 탭 외부 HTTP 요청 0건 확인
```

---

## 6. 프로덕션 실 배포 전환 체크리스트 (T26/T27 대비)

1. [ ] T25 프리뷰 아티팩트 및 로컬 스모크 테스트 PASS 확인
2. [ ] T26 운영자(회기님) UAT 및 사업자 표시 문구 수동 승인
3. [ ] GitHub 저장소 `main` 브랜치 머지 및 Cloudflare Pages 연동
4. [ ] 실 프로덕션 도메인 연결 및 SSL 인증서 자동 발급 확인
