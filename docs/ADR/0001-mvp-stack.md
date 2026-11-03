# ADR 0001: 무료 MVP 기술 스택 및 호스팅 아키텍처 결정

- **상태:** ACCEPTED (G0 설계 잠금)
- **결정일자:** 2026-11-03 (Asia/Seoul)
- **티켓:** T04 (기술 ADR·설치 정책·비용 상한)
- **적용 범위:** ReturnWise 무료 MVP 전반

---

## 1. 맥락 및 배경 (Context)
ReturnWise는 한국의 소규모 1~5인 온라인 커머스 판매자를 위한 반품·환불 비용 비교 1페이지 계산기다.  
프로젝트의 핵심 목표는 다음과 같다:
1. **$0 인프라 비용:** 검증되지 않은 초기 단계에서 서버 유지비나 데이터베이스 비용이 발생하지 않아야 한다.
2. **최고 수준의 계산 신뢰도:** 복잡한 런타임 의존성 없이 1원 단위 정수 계산이 브라우저에서 100% 결정적(Deterministic)으로 실행되어야 한다.
3. **개인정보 보호(Zero-PII):** 주문번호, 고객명, 연락처 등 민감 정보를 서버에 수집하거나 외부로 전송하지 않아야 한다.
4. **초고속 반응형 단일 페이지:** 320px 모바일 환경부터 1440px 데스크톱까지 1초 미만 로딩과 부드러운 인터랙션을 제공해야 한다.

---

## 2. 의사결정 내용 (Decision)

### 2.1 채택 스택
- **프런트엔드 코어:** `React 18/19` + `TypeScript (strict mode)`
  - 엄격한 타입 정의로 `cashOutflow`와 `economicCost` 혼용 원천 방지.
- **빌드 툴:** `Vite 6.x`
  - 초고속 HMR 및 최적화된 정적 자산(Rollup 기반) 번들링.
- **스타일링:** `CSS Modules` 또는 `Plain CSS` (Tailwind 등 유틸리티 배제 또는 최소화)
  - 런타임 오버헤드가 큰 CSS-in-JS(Styled-components 등) 배제, 번들 사이즈 최소화.
- **호스팅 및 배포:** `Cloudflare Pages (정적 호스팅)`
  - 완전 무료(월 $0), 글로벌 엣지 CDN 서빙, 무제한 대역폭, GitHub main 브랜치 자동 배포.
- **단위/통합 테스트:** `Vitest` + `@testing-library/react`
  - Vite 네이티브 테스트 러너로 C01~C18 18개 계산 fixture 및 L01~L08 안전 시나리오를 밀리초 단위로 회귀 검증.
- **E2E 브라우저 테스트:** `Playwright`
  - Chromium, Firefox, WebKit, Mobile Chrome(375px) 크로스 브라우징 및 클립보드 복사 검증.
- **코드 품질 관리:** `ESLint` + `Prettier` (strict rule 적용).

### 2.2 배제된 기술 및 금지 사항 (Explicitly Banned)
- **Node.js/Next.js SSR 서버:** 동적 서버 렌더링 배제 (서버 호스팅 비용 발생 방지).
- **데이터베이스 (PostgreSQL, Supabase, Firebase 등):** 일체 도입 금지 (초기 브라우저 메모리만 사용).
- **사용자 인증 (Auth0, NextAuth, Supabase Auth 등):** 로그인 없는 완전 무료 공개 사이트 원칙.
- **외부 AI API (OpenAI, Claude, Perplexity 등):** 규칙 기반 순수 함수로 처리 (API 토큰 비용 및 환각 방지).
- **PG 결제 연동 (토스페이먼츠, 스트라이프 등):** G5 사업성 검증 전까지 결제 모듈 설치 일체 금지.

---

## 3. 결과 및 효과 (Consequences)
- **긍정적 효과:**
  - 서버 운영비 $0 실현 (Cloudflare Pages 무료 티어 100% 활용).
  - PII 누출 위험 0% (서버와 DB가 존재하지 않으므로 해킹 및 유출 표면 자체가 없음).
  - 매우 가벼운 정적 번들 (gzip 기준 JS 100KB 미만 목표).
- **수용된 제약:**
  - 기기 간 데이터 동기화 불가 (MVP에서는 비민감 기본 운송비/검수비만 로컬 스토리지에 저장).
  - 다건 CSV 일괄 처리 불가 (G5 통과 후 T36에서 재설계).
