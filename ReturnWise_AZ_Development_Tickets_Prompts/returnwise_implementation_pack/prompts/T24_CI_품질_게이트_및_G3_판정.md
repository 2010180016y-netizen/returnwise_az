# T24 | CI·품질 게이트 및 G3 판정

> G3 / 무료 MVP 또는 사업검증 단계
> 선행 조건: T19,T20,T21,T22,T23

## 개발 에이전트에게 붙여넣을 실행 프롬프트

너는 ReturnWise 프로젝트의 구현 책임자다. 먼저 저장소 상태와 `prompts/00_MASTER_PROMPT.md`, `START_HERE.md`, PRD/금융 산식/법률 게이트/기술 명세를 읽고 현재 티켓의 선행 조건 `T19,T20,T21,T22,T23` 완료 여부를 **실제 파일과 테스트로** 확인하라. 선행 조건 미충족이면 임의 보완·월권하지 말고 BLOCKED 보고서를 작성하라.

**현재 실행할 티켓은 T24 — CI·품질 게이트 및 G3 판정 하나뿐이다.**

**목적:** 테스트 실패 코드가 배포되지 않도록 차단한다.

**구체적 작업 지시:** GitHub Actions PR 워크플로: npm ci→typecheck→lint→unit→build→Playwright E2E→audit; cache, artifact, minimal permissions, concurrency, branch rules 안내; 테스트 로그, G1/G2/G3 결과 집계; 미해결 보안/계산/법률 P0 발견시 G3 FAIL.

**최소 산출물:** .github/workflows/ci.yml, docs/implementation/G3_REPORT.md. 반드시 구현 및 테스트의 변경 파일 경로를 명시하고 `docs/implementation/T24_REPORT.md`를 남겨라.

**합격 판정기준:** PR에서 실패 시 적색; 모든 테스트 재현; 문서/증거 링크와 G3 판정.

**특별 안전조건:** 브랜치보호 적용에 계정 권한 요구할 경우 사용자에게 설정 절차 제공.

실행 순서는 (1) 현 상태 확인 및 작은 실행계획 (2) 최소 변경 구현 (3) 명시한 판정기준의 테스트 작성·실행 (4) 반례·엣지케이스 검토 (5) 변경 파일/테스트 증빙 정리 (6) `PASS/CONDITIONAL/FAIL/BLOCKED` 판정이다. 실행하지 못한 명령은 `NOT_RUN`으로 남기고, 무단 결제/외부 공개/배포/원격 푸시 없이 종료하라. 범위 밖 발견사항은 다음 티켓 후보로 적어라.

**답변 형식:** `판정 → 실제 변경 파일 → 구현 핵심 → 실행한 테스트(명령·결과) → 미검증·잔여 위험 → 다음 티켓 진행 가능 여부`.
