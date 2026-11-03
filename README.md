# ReturnWise (반품·환불·교환 비용 비교 계산기)

한국 소규모 온라인 커머스 판매자를 위한 반품 처리방식별 추가 현금지출 및 순경제적 손실 비교 단일 페이지 계산기.

## 1. 기술 스택
- **Core:** React 18, TypeScript (strict mode), Vite 5
- **Style:** Pure CSS, CSS Modules
- **Testing:** Vitest, Testing Library, Playwright
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

# 단위 테스트 실행 (Vitest)
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
