# S2 실행 결과 보고서 — Toss Payments 결제 보안

- 작업일: 2026-11-03 (Asia/Seoul)
- 코드 브랜치: `security/s2-verified-billing`
- 코드 PR: https://github.com/2010180016y-netizen/returnwise_az/pull/2 (Draft, main 대상)
- 선행 PR: https://github.com/2010180016y-netizen/returnwise_az/pull/1
- 기준: S1 402/402 CI PASS
- 본 S2 최신 검증: GitHub Actions https://github.com/2010180016y-netizen/returnwise_az/actions/runs/41582914515
- CI 실측: **418 tests / 418 PASS / 0 FAIL**, typecheck/lint/build/npm audit PASS.
- 최종 판정: **S2 security core PASS (SANDBOX ONLY) / Pro production gate BLOCKED**.

## 변경 파일

- `server/billing/billingService.ts`: 공식 서명 규격으로 HMAC 구현 및 무검증 유료 권한 변경 함수 제거
- `server/billing/verifiedBilling.ts`: 입력 검증, 내부 주문 조회, PG 조회 결과 교차검증, 트랜잭션 레저 인터페이스
- `server/billing/tossPaymentLookup.ts`: test secret 전용 조회 클라이언트 (실결제 없음)
- `tests/billing/webhook_security.test.ts`: 신규 위변조·역순·권한·중복·취소·정합성 테스트
- `.github/workflows/ci.yml`: 모든 PR 및 중첩 PR에 품질 검증 실행
- `docs/security/S2_BILLING_SECURITY.md`: 위협 모델, 기술 계약, S3 후속 게이트
- `docs/implementation/T39_REPORT.md`, `T40_REPORT.md`: 기존 PASS 오인 가능 내용 정정

## 실제로 차단한 취약 경로

1. 위조된 `DONE` 본문만 제공하여 Pro 권한을 활성화할 수 있는 함수 제거.
2. 일반 API secret key를 웹훅 HMAC 키처럼 사용하던 오류 수정.
3. 다중 v1 서명 및 원문+전송시각 검증.
4. 내부 주문 없는 결제, 다른 상점 ID, 다른 금액, 다른 주문번호, 다른 결제키, 이전 상태 등 차단.
5. 테스트/샌드박스 외에는 처리 불가; 유료 결제 API를 호출하지 않음.
6. 중복 이벤트 계약: 이벤트 식별자뿐 아니라 주문/결제키/상태 단위 중복 제거를 영속 레저의 의무조건으로 명시.

## 이 결과로는 인정할 수 없는 것

- 토스페이먼츠 실제 API와의 연동 테스트 PASS (모의 fetch만 검증함)
- Cloudflare D1에서의 원자 트랜잭션, 이벤트 영속화 또는 재시도
- 결제 상태의 네트워크 장애 중 정확한 재조정
- 정기결제 승인 API 응답에서의 서버측 성공 검증
- 실제 webhook HTTPS 엔드포인트 가동
- 사용자의 Pro 유료 권한에 대한 운영 서버 검증
- 라이브 계약·가입·승인·실결제

위 항목들은 **S3 이전 및 후속 작업 완료 전까지 BLOCKED**이며, `main`에는 병합하지 않았습니다.

## 권장 후속 순서

1. PR #1 검토/병합 후 PR #2 충돌·차이 재검증 및 병합 검토
2. S3 D1 billing orders/events/subscriptions 원자 트랜잭션 구현
3. 중복/다중 Worker 경쟁·백업/복원·테넌트 분리 E2E
4. 자동결제 API 응답을 별도 경로로 인증·조회·상태 반영
5. 토스 테스트 키로 sandbox 통합 검증
6. 운영자 계약·법률·보안·서비스 정책 검토 이후에만 LIVE 플래그 설계

공식 가이드:
https://docs.tosspayments.com/reference/using-api/webhook-events
https://docs.tosspayments.com/reference/using-api/security-checklist
