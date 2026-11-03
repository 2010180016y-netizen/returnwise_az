# ReturnWise — A–Z 구현 패키지 (2026-11-03)

> 목적: **한 페이지로 실제 업무에 도움이 되는 무료 계산기**를 먼저 출시하고, 반복 이용과 유료 수요가 검증된 이후에만 Pro 제품을 구축한다.

## 읽기 및 실행 순서
1. `docs/01_PRD.md` → 제품·범위·성공 기준
2. `docs/02_FINANCIAL_DOMAIN.md` → 단일 계산 정의, 예시, 금지된 오해
3. `docs/03_LEGAL_SAFETY.md` → 법률·마켓 규정 검토/게이트
4. `docs/04_UX_SPEC.md` → 화면 및 텍스트
5. `docs/05_ARCHITECTURE.md` → 기술·배포·보안
6. `docs/06_TEST_PLAN.md` → 계산/기능/접근성/성능 테스트
7. `docs/07_GROWTH_REVENUE.md` → 검증·SEO·수익화
8. `docs/08_RELEASE_RUNBOOK.md` → 운영·수동 승인·복구
9. `docs/TICKET_INDEX.md` → 종속성과 순서
10. `prompts/00_MASTER_PROMPT.md`를 작업 에이전트에게 제공한 후, `prompts/T...md`를 **순차적으로 한 개씩** 입력한다.

## 게이트
- G0: 문제와 법률 리스크/제품 범위 정리됨 (T00–T04)
- G1: 정확한 계산 엔진+안전 게이트 통과 (T05–T10)
- G2: 사용 가능한 한 페이지 MVP (T11–T18)
- G3: 테스트·보안·SEO·계측 완료 (T19–T24)
- G4: 프로덕션 출시 승인 (T25–T28)
- G5: 실제 이용과 결제 의향 입증 (T29–T32)
- G6: 조건부 유료 제품 구현 및 출시 (T33–T40)

**G4까지**가 무료 MVP 출시에 필요한 범위다. **G5가 충족되지 않으면 T33–T40을 실행하지 않는다.**

## 작업 환경
- Codex / Claude Code 등 저장소 읽기·쓰기·명령 실행이 가능한 개발 에이전트에 붙여넣는다.
- 저장소가 없으면 T00에서 새로 생성한다.
- 명시 승인 전에는 유료 API, 유료 Cloudflare 플랜, 결제 서비스 계약, 사용자에게 영향을 주는 메시지 발송, 외부 게시/발행, 프로덕션 배포를 하지 않는다.
- 에이전트가 깃허브, 브라우저, 법률 DB에 접근하지 못하면 접근 불가를 기록하고 추정/위조 없이 다음 게이트를 BLOCKED로 판정한다.
- 구현/테스트 결과를 매 티켓 `docs/implementation/Txx_REPORT.md`로 기록한다. 실제 테스트와 미실행 테스트를 반드시 구분한다.

## 필수 산출물
- 실제 코드: `src/domain`(순수 함수), `src/features/calculator`, `src/components`, `src/content`, `src/lib`
- 테스트: `tests/unit`, `tests/e2e`, 회귀 fixture
- 운영: GitHub CI, 배포/복구 문서, 장애 대응, 분석/개선 루틴
- 문서: ADR/검증 로그, 릴리스 판정/잔여 위험

> 이 패키지는 개발 지시서다. 코드가 실제 구현되었거나 법률 전문가가 검토했음을 뜻하지 않는다.
