# ReturnWise 인프라 비용 예산 및 성능 예산 명세서 (COST_BUDGET.md)

- **버전:** v1.0.0 (G0 잠금)
- **작성 일자:** 2026-11-03 (Asia/Seoul)
- **티켓 ID:** T04 (기술 ADR·설치 정책·비용 상한)
- **비용 목표:** **월 0원 ($0.00 / month)**

---

## 1. 월간 인프라 비용 상한 (Cost Budget)

ReturnWise 무료 MVP의 모든 인프라는 완전 무료 티어(Zero-Cost) 내에서 운용되며, 사전 승인 없는 유료 리소스 프로비저닝은 일체 금지된다.

| 항목 | 채택 솔루션 | 무료 티어 스펙 및 한도 | 월간 비용 |
| :--- | :--- | :--- | :--- |
| **웹 호스팅** | Cloudflare Pages | 월 500회 빌드, 무제한 대역폭, 무제한 요청 | **$0.00 (0원)** |
| **엣지 CDN & SSL** | Cloudflare Edge Network | 글로벌 330+ 도시 애니캐스트, 자동 SSL 인증서 | **$0.00 (0원)** |
| **형상관리 & CI** | GitHub Free Tier | 무제한 프라이빗 저장소, Actions 월 2,000분 무료 | **$0.00 (0원)** |
| **도메인** | `*.pages.dev` 기본 제공 | Cloudflare 기본 서브도메인 (영구 무료) | **$0.00 (0원)** |
| **데이터베이스** | 브라우저 로컬 스토리지 | 사용자 기기 내 로컬 격리 (서버 비용 0) | **$0.00 (0원)** |
| **사용자 인증** | 없음 (가입 없는 공개 도구) | 인증 인프라 불필요 | **$0.00 (0원)** |
| **외부 AI / LLM API**| 없음 (규칙 기반 순수 함수) | API 토큰 호출 비용 0원 | **$0.00 (0원)** |
| **PG 결제 모듈** | 없음 (무료 MVP 원칙) | PG 가입비, 연회비, 수수료 0원 | **$0.00 (0원)** |
| **월간 인프라 총액**| **전체 무료 조합** | **한도 초과 없는 무제한 정적 호스팅** | **$0.00 (0원)** |

> **선택적 커스텀 도메인 정책:**  
> 향후 독립 브랜드 도메인(`returnwise.kr` 등) 연동이 필요할 경우, 연간 약 15,000원~20,000원의 도메인 등록비는 반드시 사용자의 명시적 수동 승인 하에서만 집행하며, 기본 상태는 `*.pages.dev` 무료 도메인을 사용한다.

---

## 2. 성능 및 품질 예산 (Performance & Quality Budget)

사용자 경험과 모바일 접근성을 극대화하기 위해 다음 성능 예산을 엄격히 준수한다:

### 2.1 번들 사이즈 예산 (Gzip 압축 기준)
- **Initial JavaScript Bundle:** $\le 120\text{ KB}$ (Vite 코드 스플리팅 적용)
- **Initial CSS Bundle:** $\le 30\text{ KB}$ (경량 CSS Modules)
- **초기 로드 전체 정적 자산:** $\le 200\text{ KB}$ (이미지, 폰트 포함)

### 2.2 Lighthouse 모바일 성능 지표 목표
- **Performance (성능):** $\ge 90$ 점
- **Accessibility (접근성):** $\ge 95$ 점 (WCAG 2.2 AA 준수)
- **Best Practices (모범사례):** $\ge 95$ 점 (HTTPS, 보안 헤더)
- **SEO (검색엔진 최적화):** $\ge 90$ 점 (시맨틱 태그, OpenGraph)

### 2.3 Core Web Vitals 목표
- **LCP (Largest Contentful Paint):** $\le 1.5$ 초 (모바일 4G 기준)
- **INP (Interaction to Next Paint):** $\le 100$ ms (즉각적인 반응)
- **CLS (Cumulative Layout Shift):** $\le 0.05$ (화면 깜빡임 및 레이아웃 밀림 방지)

---

## 3. GitHub PR 및 프로덕션 배포 통제 규칙

1. **자동화 CI 품질 게이트:**
   - 모든 Pull Request는 GitHub Actions에서 다음 4대 검사를 통과해야만 머지할 수 있다:
     - `npm run lint` (ESLint 에러 0건)
     - `npm run typecheck` (TypeScript strict 컴파일 에러 0건)
     - `npm test -- --run` (Vitest C01~C18, L01~L08 테스트 100% 통과)
     - `npm run build` (Vite 빌드 에러 및 번들 상한 초과 0건)
2. **프로덕션 릴리스 수동 승인 게이트 (Manual Gate):**
   - Cloudflare Pages 프리뷰(Preview) 배포는 브랜치별로 자동 생성될 수 있으나, **정식 프로덕션 도메인 릴리스는 반드시 운영자(회기님)의 명시적 승인(T26/T27) 하에서만 실행**한다.
   - 원격 저장소 직접 `push --force` 및 미승인 원격 반영을 영구 금지한다.
