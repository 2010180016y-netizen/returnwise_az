# 05. 기술 아키텍처 및 비기능 요구

## MVP 스택
React + TypeScript(strict) + Vite, 최소 라이브러리, CSS Modules 또는 plain CSS, Vitest, Testing Library, Playwright, ESLint, Prettier, GitHub Actions, Cloudflare Pages(정적). 초기 서버/DB/API/AI API 없음. GitHub는 private repository 기본.

공식 레퍼런스:
- https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/
- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://vite.dev/guide/static-deploy.html

## 폴더 구조
```
src/
  app/                 # bootstrap, error boundary, router가 필요하다면 최소화
  domain/              # pure calculations, eligibility, money types, validation
  features/calculator/ # form/view-model/results
  components/          # accessible shared controls
  content/             # FAQ, docs, copy
  lib/                 # safe local storage, clipboard helpers
  styles/
tests/
  unit/
  integration/
  e2e/
public/                # favicon, robots.txt, sitemap.xml
.github/workflows/
docs/implementation/
```

## 의존성 원칙
- `domain/`은 React, DOM, localStorage, API 호출을 import하지 않음.
- 모든 금액 비교는 재현 가능한 순수 함수. source-of-truth JSON fixture를 유지.
- 브라우저 상태는 명시적 `FormState`/`ValidationResult`/`ScenarioResult` 타입.
- 수수료 환급 또는 법률 규칙을 외부에서 자동 추정하지 않음.
- MVP에서 고객 데이터/주문 데이터 저장·전송 금지.

## 품질/보안 목표 (비공식 내부 기준)
- `npm run lint`, `npm run typecheck`, `npm test -- --run`, `npm run build`, `npx playwright test` 모두 PASS.
- 핵심 계산 domain branch coverage >=95% (가능한 보고서 기반), UI total coverage >=80% 목표; 부족 시 사유/보완 명시.
- Lighthouse 모바일 성능 90 이상/접근성 95 이상을 **목표치**로 두되 실제 측정 실행 없이는 달성 주장 금지.
- 외부 CDN JS, 광고, tracker, cookies 기본 없음. 비밀값은 repo에 저장 금지.
- CSP, security headers, HTTPS, 소스맵 정책, dependency audit, `npm ci` lockfile 재현성 점검.
- CI에는 최소 권한, PR 테스트, preview, production protected/main manual approval.

## 별도 Pro 확장 전제
- 계정/조직/테넌트, 최소수집, 서버 측 권한 검사와 데이터 격리, 사용자별 데이터 삭제/백업, 정기결제/웹훅·정산, CSV 업로드를 포함. 비용·운영체계 추가 전 G5 확인.

## 공개 배포 통제
신규 repo 작성과 PR, GitHub push, Cloudflare 연결, custom domain 설정, 공개 페이지 런칭은 주체 계정과 권한을 요구한다. 대리 실행은 명시 승인 및 권한이 있을 때만 하고 각 실행을 기록한다.
