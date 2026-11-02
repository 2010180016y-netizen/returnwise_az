# T04 | 기술 ADR·설치 정책·비용 상한

> G0 / 무료 MVP 또는 사업검증 단계
> 선행 조건: T01,T03

## 개발 에이전트에게 붙여넣을 실행 프롬프트

너는 ReturnWise 프로젝트의 구현 책임자다. 먼저 저장소 상태와 `prompts/00_MASTER_PROMPT.md`, `START_HERE.md`, PRD/금융 산식/법률 게이트/기술 명세를 읽고 현재 티켓의 선행 조건 `T01,T03` 완료 여부를 **실제 파일과 테스트로** 확인하라. 선행 조건 미충족이면 임의 보완·월권하지 말고 BLOCKED 보고서를 작성하라.

**현재 실행할 티켓은 T04 — 기술 ADR·설치 정책·비용 상한 하나뿐이다.**

**목적:** 최소 비용 정적 앱 아키텍처를 고정한다.

**구체적 작업 지시:** Vite/React/TS strict/Cloudflare Pages/Vitest/Playwright/ESLint 선택 기록; React 없는 domain 설계; localStorage 최소 이용; 패키지 설치/lockfile/보안정책; 접근성 및 품질 예산; Firebase/Supabase/Auth 등 불필요한 의존성 제외; GitHub PR/production 승인 규칙 작성.

**최소 산출물:** docs/ADR/0001-mvp-stack.md, docs/ADR/0002-domain-isolation.md, docs/COST_BUDGET.md. 반드시 구현 및 테스트의 변경 파일 경로를 명시하고 `docs/implementation/T04_REPORT.md`를 남겨라.

**합격 판정기준:** 새 외부 유료 서비스/AI/DB 의존성 없음; ADR 1~3개와 구조표; 출처·비용 위험 정리.

**특별 안전조건:** 유료 리소스 프로비저닝 금지.

실행 순서는 (1) 현 상태 확인 및 작은 실행계획 (2) 최소 변경 구현 (3) 명시한 판정기준의 테스트 작성·실행 (4) 반례·엣지케이스 검토 (5) 변경 파일/테스트 증빙 정리 (6) `PASS/CONDITIONAL/FAIL/BLOCKED` 판정이다. 실행하지 못한 명령은 `NOT_RUN`으로 남기고, 무단 결제/외부 공개/배포/원격 푸시 없이 종료하라. 범위 밖 발견사항은 다음 티켓 후보로 적어라.

**답변 형식:** `판정 → 실제 변경 파일 → 구현 핵심 → 실행한 테스트(명령·결과) → 미검증·잔여 위험 → 다음 티켓 진행 가능 여부`.
