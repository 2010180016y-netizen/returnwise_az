# T05 | Vite+React+TS 프로젝트 스캐폴드

> G1 / 무료 MVP 또는 사업검증 단계
> 선행 조건: T04

## 개발 에이전트에게 붙여넣을 실행 프롬프트

너는 ReturnWise 프로젝트의 구현 책임자다. 먼저 저장소 상태와 `prompts/00_MASTER_PROMPT.md`, `START_HERE.md`, PRD/금융 산식/법률 게이트/기술 명세를 읽고 현재 티켓의 선행 조건 `T04` 완료 여부를 **실제 파일과 테스트로** 확인하라. 선행 조건 미충족이면 임의 보완·월권하지 말고 BLOCKED 보고서를 작성하라.

**현재 실행할 티켓은 T05 — Vite+React+TS 프로젝트 스캐폴드 하나뿐이다.**

**목적:** 타입검사·테스트가 실행되는 프로젝트 기반을 마련한다.

**구체적 작업 지시:** 공식 안정 버전으로 Vite React TS 생성; 폴더 아키텍처 생성; TypeScript strict; eslint/prettier; npm scripts(dev/build/lint/typecheck/test/e2e); lockfile commit; React 화면 최소; README 실행법; .gitignore·.env.example 점검.

**최소 산출물:** package.json, src/*, tsconfig*, eslint*, vite*, README.md. 반드시 구현 및 테스트의 변경 파일 경로를 명시하고 `docs/implementation/T05_REPORT.md`를 남겨라.

**합격 판정기준:** `npm ci`, `npm run build`, `npm run lint`, `npm run typecheck` 통과; domain 에 React import 없음.

**특별 안전조건:** 환경에 없는 실행을 PASS로 보고 금지.

실행 순서는 (1) 현 상태 확인 및 작은 실행계획 (2) 최소 변경 구현 (3) 명시한 판정기준의 테스트 작성·실행 (4) 반례·엣지케이스 검토 (5) 변경 파일/테스트 증빙 정리 (6) `PASS/CONDITIONAL/FAIL/BLOCKED` 판정이다. 실행하지 못한 명령은 `NOT_RUN`으로 남기고, 무단 결제/외부 공개/배포/원격 푸시 없이 종료하라. 범위 밖 발견사항은 다음 티켓 후보로 적어라.

**답변 형식:** `판정 → 실제 변경 파일 → 구현 핵심 → 실행한 테스트(명령·결과) → 미검증·잔여 위험 → 다음 티켓 진행 가능 여부`.
