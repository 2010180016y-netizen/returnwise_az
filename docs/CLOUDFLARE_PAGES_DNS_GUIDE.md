# ReturnWise Cloudflare Pages 정적 배포 및 DNS 설정 완결 가이드

- **문서 식별자**: `docs/CLOUDFLARE_PAGES_DNS_GUIDE.md`
- **대상 프로젝트**: ReturnWise (`2010180016y-netizen/returnwise_az`)
- **버전**: v0.1.0 Phase 1 무료 MVP
- **원칙**: $0 무자본 서버리스, Zero Environment Variables, 엄격한 정적 보안 격리

---

## 1. 배포 아키텍처 개요

ReturnWise는 100% 클라이언트 사이드 React 정적 애플리케이션(SPA)입니다.
- **호스팅**: Cloudflare Pages Free Tier (월 500회 빌드, 무제한 대역폭, 100개 커스텀 도메인 $0)
- **런타임 의존성**: 서버 API 0건, 데이터베이스 0건, 외부 유료 인증키 0건
- **보안 격리**: CSP `connect-src 'none'`, HSTS, X-Content-Type-Options nosniff 자동 강제
- **빌드 아티팩트**: `dist/` (단일 index.html, 번들 JS/CSS, `_headers`, `_redirects`, `404.html`, `sitemap.xml`)

---

## 2. Cloudflare Pages 프로젝트 생성 및 Git 연동 (Step-by-Step)

### Step 1: Cloudflare 대시보드 진입
1. [Cloudflare Dashboard](https://dash.cloudflare.com/) 로그인
2. 좌측 네비게이션 메뉴에서 **Workers & Pages** 클릭
3. 우측 상단 **Create application** 버튼 클릭 -> **Pages** 탭 선택 -> **Connect to Git** 클릭

### Step 2: GitHub 저장소 선택
1. GitHub 계정(`2010180016y-netizen`) 연동 확인
2. 저장소 목록에서 `returnwise_az` 선택
3. **Begin setup** 클릭

### Step 3: 빌드 및 배포 설정 구성 (Build Configuration)
아래 표의 설정값을 입력합니다 (오타 주의):

| 설정 항목 | 설정값 | 설명 |
|:---|:---|:---|
| **Project name** | `returnwise` | 기본 발급 도메인: `https://returnwise.pages.dev` |
| **Production branch** | `main` | 프로덕션 자동 배포 대상 브랜치 |
| **Framework preset** | `None` (Custom) | 자체 경량 esbuild 파이프라인 사용 |
| **Build command** | `npm run build` | `tsc --noEmit && node scripts/build.mjs` 실행 |
| **Build output directory** | `dist` | 정적 번들 및 보안 헤더 위치 |
| **Root directory** | `/` (빈칸 유지) | 저장소 최상위 루트 |
| **Environment variables** | **설정 없음 (Empty)** | $0 원칙, 외부 비밀키 일체 불필요 |

### Step 4: 첫 배포 완료 상태 (2026-11-03 실측)
- **라이브 URL**: `https://returnwise-az.pages.dev/` (HTTP 200 실측 완료)
- **배포 브랜치**: `main` (커밋 `b590744` 기반 자동 빌드 성공)
- **빌드 파이프라인**: Node.js v22, `npm run build`, `dist/` 정적 번들, 보안 헤더 및 리다이렉트 규칙 4건 파싱 완료.

---

## 3. 커스텀 도메인 및 DNS 설정 가이드

### Case A: Cloudflare에 등록/관리 중인 도메인 (가장 간단)
도메인이 이미 Cloudflare DNS에 등록되어 있는 경우(예: `hoiki0808` 계정 내 도메인):

1. **Pages 프로젝트 진입**: `Workers & Pages` -> `returnwise` 클릭
2. **커스텀 도메인 탭**: 상단 **Custom domains** 탭 클릭 -> **Set up a custom domain** 버튼 클릭
3. **도메인 입력**:
   - 서브도메인 예시: `calc.yourdomain.com` 또는 `returnwise.yourdomain.com`
   - 루트 도메인 예시: `yourdomain.com`
4. **DNS 레코드 자동 구성**:
   - Cloudflare가 자동으로 CNAME 레코드를 생성하고 오렌지색 프록시(`Proxied`)를 활성화합니다.
5. **SSL/TLS 인증서 발급**:
   - Cloudflare Universal SSL이 자동으로 활성화되며 1~2분 내 TLS 1.3 HTTPS 암호화 적용 완료.

---

### Case B: 타사 네임서버(가비아, 후이즈, AWS Route53 등)를 사용하는 도메인

#### 1) 서브도메인 연결 (권장: `calc.yourdomain.com` 또는 `return.yourdomain.com`)
기존 DNS 관리 콘솔(가비아/후이즈/AWS 등)의 DNS 레코드 관리 화면에서 아래 레코드를 추가합니다:

| 유형 (Type) | 호스트/이름 (Name) | 값/대상 (Target/Value) | TTL |
|:---:|:---:|:---:|:---:|
| **CNAME** | `calc` (또는 `return`) | `returnwise.pages.dev` | 300 (또는 자동) |

#### 2) 루트 도메인(Apex: `yourdomain.com`) 직접 연결 시
- 타사 DNS가 **CNAME Flattening** 또는 **ALIAS / ANAME** 레코드를 지원하는 경우:
  - 유형: `ALIAS` 또는 `ANAME`
  - 호스트: `@` (또는 비워둠)
  - 값: `returnwise.pages.dev`
- 타사 DNS가 Apex CNAME을 지원하지 않는 경우:
  - 네임서버를 Cloudflare로 이전하거나,
  - `www` 서브도메인을 CNAME으로 연결하고 루트 도메인은 `www`로 301 포워딩 설정.

#### 3) 소유권 검증 TXT 레코드 (필요 시)
Cloudflare Pages 대시보드에서 요구할 경우 아래 검증용 레코드를 추가합니다:
- **Type**: `TXT`
- **Name**: `_cf-custom-hostname.yourdomain.com`
- **Value**: Cloudflare 대시보드에 표시되는 고유 토큰값

---

## 4. 보안 헤더, 라우팅 및 캐싱 검증

배포 완료 후 프로덕션 URL에 대해 아래 4대 검증을 수행합니다:

### 1) 보안 헤더 검증 (`dist/_headers`)
```bash
curl -I https://returnwise.pages.dev
```
- `content-security-policy: connect-src 'none'; ...` (외부 통신 원천 차단)
- `strict-transport-security: max-age=31536000; includeSubDomains; preload` (1년 강제 HTTPS)
- `x-content-type-options: nosniff` (MIME 스니핑 방지)
- `x-frame-options: DENY` (클릭재킹 방지)

### 2) 별칭 리다이렉트 검증 (`dist/_redirects`)
- `https://returnwise.pages.dev/calculator` 접속 시 -> `https://returnwise.pages.dev/`로 301 즉시 이동
- `/return`, `/refund`, `/exchange` 경로 동일 검증

### 3) 404 에러 및 검색엔진 차단 (`dist/404.html`)
- `https://returnwise.pages.dev/unknown-path` 접속 시:
  - HTTP 404 상태코드 응답
  - `X-Robots-Tag: noindex, nofollow` 헤더 응답
  - 정적 404 안내 화면 및 [계산기 메인으로 이동] 링크 노출

---

## 5. 프로덕션 스모크 테스트 체크리스트 (5분 UAT)

배포 직후 실제 브라우저에서 아래 5개 시나리오를 점검합니다:

1. [ ] **초기 로드**: FCP < 0.6초, 콘솔 에러(빨간색) 0건, 네트워크 탭 외부 전송 0건
2. [ ] **반품 계산**: 판매가 30,000원, 왕복 6,000원 입력 시 표준반품/회수포기/부분환불 3대 대안 즉시 비교
3. [ ] **법률 가드레일**: 판매자 귀책 선택 시 고객 반품비 부담 불가(0원 강제) 정상 안내
4. [ ] **클립보드 복사**: [리포트 복사] 클릭 시 No-PII 정형 텍스트 클립보드 복사 피드백 노출
5. [ ] **반응형 모바일**: 스마트폰 세로 모드(375px~430px)에서 수평 스크롤 없이 모든 버튼(44px) 정상 탭

---

## 6. 비상 롤백 절차 (장애 발생 시 10초 복구)

만약 배포 후 버그나 이상이 발생할 경우 Cloudflare 대시보드에서 10초 만에 직전 버전으로 되돌립니다:
1. `Workers & Pages` -> `returnwise` 프로젝트 선택
2. 상단 **Deployments** 탭 클릭
3. 직전 정상 배포 우측의 `...` (더보기) 클릭 -> **Rollback to this deployment** 선택
4. 즉시 전 세계 엣지 네트워크에 이전 빌드 버전 복구 완료
