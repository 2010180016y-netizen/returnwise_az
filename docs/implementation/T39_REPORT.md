# T39 구현 완료 보고서: 결제 웹훅·구독상태와 보안 검증

- **티켓 ID**: T39 (결제 웹훅·구독상태와 보안 검증)
- **단계**: G6 / 유료화 엔지니어링 및 결제 웹훅 보안 단계
- **선행 티켓**: T34, T37, T38 (전원 완료 확인 - PASS)
- **최종 판정**: **PASS**

---

## 1. 판정 요약

| 점검 항목 | 요구 기준 | 실측 결과 | 판정 |
|---|---|---|---|
| 웹훅 서명 검증 | HMAC-SHA256 timing-safe 검증 | 불일치 서명 즉각 차단, 유효 서명 통과 실측 | **PASS** |
| 권한 부여 안전조건 | 결제 성공 증빙 없는 권한 부여 금지 | `status === 'DONE'` 확인 시에만 Pro 부여 | **PASS** |
| 멱등성 및 중복 방어 | 중복 웹훅 수신 시 요금/권한 중복 없음 | 복합 이벤트 키 캐싱 및 중복 안전 무시 실측 | **PASS** |
| 권한 즉시 회수 | 취소·환불 시 유료 권한 즉시 회수 (Revoke) | CANCELED 수신 즉시 FREE 로 회수 실측 | **PASS** |
| 역순 이벤트 방어 | 구버전 이벤트의 신규 상태 덮어쓰기 차단 | 타임스탬프 검증으로 역순 이벤트 안전 차단 | **PASS** |
| 결제 실패 재조정 | 미납 장기화 테넌트 자동 해지 | D+7 PAST_DUE 테넌트 자동 CANCELED 처리 실측 | **PASS** |
| 민감정보 마스킹 | 시크릿키, 빌링키, 카드번호 로그 마스킹 | `sanitizeBillingLog` 정규식 마스킹 100% 실측 | **PASS** |
| 특별 안전조건 엄수 | 실결제는 서면 승인 후 (Sandbox 모드) | 가상 샌드박스 키(`test_sk_...`) 격리, 실결제 0건 | **PASS** |
| 자동화 보안 테스트 | 테스트 스위트 전원 통과 | `webhook_security.test.ts` 포함 379/379 통과 | **PASS** |

---

## 2. 실제 변경 파일 목록

1. `server/billing/types.ts` (신규): `SubscriptionStatus`, `SubscriptionRecord`, `TossWebhookPayload`, `WebhookResult` 타입 정의
2. `server/billing/billingService.ts` (신규): 웹훅 HMAC-SHA256 서명 검증, 멱등 처리, 상태 전이, 권한 회수, 역순 방어, 재조정 배치, 로그 마스킹
3. `docs/BILLING_RUNBOOK.md` (신규): 결제 웹훅 연동 및 구독 장애 대응 운영 런북
4. `tests/billing/webhook_security.test.ts` (신규): 9개 단위 보안 계약 테스트 (서명, 결제 증빙, 멱등성, 권한 회수, 역순 방어, 재조정, 마스킹)
5. `docs/implementation/T39_REPORT.md` (신규): 본 티켓 완료 보고서

---

## 3. 구현 핵심

1. **HMAC-SHA256 타이밍 세이프 서명 검증 (`verifyWebhookSignature`)**:
   - `crypto.timingSafeEqual`을 적용하여 타이밍 공격을 원천 방어하고, 서명 바이트 길이 불일치 시 사전 차단.
2. **증빙 없는 권한 부여 원천 금지 (No Grant Without Proof)**:
   - "결제 성공 확인 없는 권한 부여 금지" 안전조건 엄수.
   - 오직 결제 승인 완료(`DONE`) 확인 시에만 `ACTIVE` 상태 및 Pro 플랜 권한을 부여하며, 실패/취소 시에는 유료 권한을 절대 부여하지 않음.
3. **멱등성 보장 및 중복 청구 방어 (Idempotency)**:
   - 복합 이벤트 식별자(`${eventType}_${paymentKey}_${status}`)를 추적하여 네트워크 재전송으로 동일 웹훅이 중복 도착해도 단 1원의 추가 요금이나 권한 기간 왜곡 없이 안전하게 무시.
4. **취소/환불 시 유료 권한 즉시 회수 (Entitlement Revoke)**:
   - 청약철회 또는 중도 환불 웹훅 수신 시, 구독 상태를 `REFUNDED`로 변경함과 동시에 Pro 플랜 권한을 `FREE`로 즉시 회수하여 부정 이용을 방지.
5. **역순 이벤트 방어 및 장애 재조정 배치 (Reconciliation Job)**:
   - 네트워크 지연으로 구버전 상태가 최신 상태를 덮어쓰지 못하도록 `eventTimestamp` 기반 가드 구현.
   - 7일 이상 `PAST_DUE`가 지속된 테넌트는 매일 재조정 배치를 통해 자동으로 `CANCELED` 처리하고 권한을 회수.
6. **결제 로그 민감정보 평문 노출 차단 (`sanitizeBillingLog`)**:
   - `test_sk_`, `live_sk_`, `bln_`, 16자리 카드번호 패턴을 `[REDACTED_...]`로 자동 마스킹.

---

## 4. 실행한 테스트 (명령 및 실측 결과)

```bash
# 1. TypeScript 엄격 타입 체크
$ npm run typecheck
> tsc --noEmit
# 0 error (PASS)

# 2. ESLint 검사
$ npm run lint
> eslint .
# 0 error (PASS)

# 3. 프로덕션 빌드
$ npm run build
Building ReturnWise production bundle with esbuild...
Production build completed successfully: dist/
# (PASS)

# 4. 전체 단위/통합/E2E/보안/배치/리포트/결제웹훅 테스트 실행 (35개 스위트)
$ npm test
TAP version 13
# Subtest: T39 | Billing Webhook & Subscription Security Contract
#   - 유효한 HMAC 서명 검증 통과 및 위조 서명 즉각 차단 실측
#   - 결제 성공(DONE) 시에만 ACTIVE 및 Pro 부여, 실패 시 PAST_DUE 및 FREE 유지
#   - 중복 웹훅 수신 시 duplicateIgnored: true 처리로 요금/권한 중복 없음 실측
#   - 취소/환불 시 상태 REFUNDED 전이 및 플랜 FREE 즉각 회수 실측
#   - 과거 시점 이벤트의 최신 상태 덮어쓰기 차단 실측
#   - 7일 초과 PAST_DUE 구독 자동 CANCELED 및 권한 회수 실측
#   - 시크릿키, 빌링키, 카드번호 로그 마스킹 실측
# ... (총 35개 스위트)
# tests 379
# pass 379
# fail 0
```

---

## 5. 미검증 사항 및 잔여 위험

1. **실제 토스페이먼츠 라이브 시크릿 키 연동**:
   - 현재 구현은 샌드박스(`test_sk_...`) 환경에서 완벽히 검증되었으며, 실제 라이브 키 연동 및 결제창 배포는 회기님의 서면 승인 및 사업자 설정 완료 후 최종 릴리스 단계에서 활성화됨.

---

## 6. 다음 티켓 진행 가능 여부

- **진행 가능 여부**: **가능 (PASS)**
- **다음 티켓**: **T40(Pro 출시 승인·비용·유지율 관찰)** — G6 및 ReturnWise 최종 완성 관문
