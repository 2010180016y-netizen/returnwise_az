# ReturnWise (반품·환불·교환 비용 비교 계산기)

한국 소규모 온라인 커머스 판매자를 위한 반품 처리방식별 추가 현금지출 및 순경제적 손실 비교 단일 페이지 계산기.

## 1. 기술 스택
- **Core:** React 18, TypeScript (strict mode), Vite 6 (dev), esbuild (production bundle)
- **Style:** Pure CSS
- **Testing:** Node.js `node:test` + esbuild bundle; E2E-named tests are SSR/contract tests, not Playwright browser automation
- **Hosting:** Cloudflare Pages ($0 무료 정적 호스팅)

## 2. 개발 및 실행 가이드

```bash
# PATH 환경변수 로드 (필수)
export PATH="/workspace/.local/bin:/workspace/.local/node/bin:$PATH"

# 의존성 설치
npm install
# 또는 재현 가능한 CI 설치
npm ci

# 로컬 개발 서버 기동 (http://localhost:5173)
npm run dev

# TypeScript strict 타입 검사
npm run typecheck

# ESLint 코드 품질 검사
npm run lint

# Node.js 테스트 실행 (SSR/contract 포함, 실제 브라우저 E2E는 별도 필요)
npm test

# 프로덕션 빌드 (dist/ 생성)
npm run build

# 빌드 결과 로컬 프리뷰
npm run preview
```

## 3. 아키텍처 원칙
- **도메인 격리 (`src/domain/`):** React, DOM, 스토리지에 일체 의존하지 않는 순수 함수 엔진.
- **Fail-closed 안전 게이트:** 고객 자발적 합의 및 마켓 정책이 확인되지 않은 부분환불/교환은 추천 후보에서 원천 차단.
- **Zero-PII:** 주문번호, 구매자명, 주소 등 개인식별정보 수집 0건. 외부 DB 및 서버 0건.

## 4. 2026-11-03 독립 점검에 따른 출시 제한

- `npm test`의 테스트 통과는 실제 브라우저 기반 Playwright E2E 검증을 의미하지 않습니다.
- `server/`의 인증, 구독, 사례 저장 모듈은 인메모리 구현으로 실제 Cloudflare D1/Workers API가 연결되지 않았습니다.
- 결제 웹훅은 공급자 결제 조회, 주문/금액/테넌트 바인딩 검증이 강제되지 않으므로 **Pro 실결제 및 유료 권한 활성화는 금지**해야 합니다.
- 무료 계산기는 별도의 실제 UAT 및 운영자 법률·정책 검토 후 공개해야 합니다.
- 감사를 위한 새 CI는 `.github/workflows/ci.yml`에서 실행됩니다. 기존 `docs/ci-workflow.yml`은 참조 문서입니다.
