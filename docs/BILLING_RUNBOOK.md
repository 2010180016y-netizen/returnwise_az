# ReturnWise 결제 웹훅 및 구독 운영 런북 (BILLING_RUNBOOK.md)

- **제품명**: ReturnWise Pro Billing System
- **문서 버전**: v1.0.0
- **적용 대상**: Cloudflare Workers 결제 웹훅 엔드포인트 (`/api/billing/webhook`)
- **최종 판정**: **PASS**

---

## 1. 개요 및 특별 안전조건 엄수

본 문서는 토스페이먼츠(Toss Payments) 정기결제 웹훅 연동, 서명 검증, 멱등성 처리, 결제 실패 복구, 그리고 민감정보 보호를 위한 운영 지침이다.

> **특별 안전조건 1**: 실결제는 서면 승인 및 사업자 설정 완료 후에만 진행한다. 현재는 $0 샌드박스(`test_sk_...`) 모드만 허용된다.
> **특별 안전조건 2**: 결제 성공 확인 없는 권한 부여는 절대 금지된다. 반드시 `status === 'DONE'` 확인 시에만 Pro 권한을 활성화한다.
> **특별 안전조건 3**: 취소 및 환불 웹훅 수신 시 Pro 권한(`entitlement`)을 즉시 무료(`FREE`)로 회수(Revoke)한다.

---

## 2. 웹훅 서명 검증 (HMAC-SHA256)

- 토스페이먼츠 웹훅 헤더: `Toss-Signature`
- 검증 로직:
  ```typescript
  const expected = crypto.createHmac('sha256', secretKey).update(rawBody).digest('base64');
  crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  ```
- 서명이 불일치하거나 헤더가 누락된 요청은 즉각 `401 Unauthorized`로 거절한다.

---

## 3. 멱등성(Idempotency) 및 중복 이벤트 처리

- 네트워크 재전송으로 동일한 웹훅 이벤트가 다중 수신될 수 있음.
- 복합 이벤트 키: `${eventType}_${paymentKey}_${status}`
- 동일 키가 이미 처리된 경우:
  - 데이터베이스 상태를 재갱신하지 않음.
  - 중복 청구나 중복 권한 연장 없이 HTTP `200 OK` 및 `{ duplicateIgnored: true }` 반환.

---

## 4. 역순 수신(Out-of-order) 및 실패 복구

- 결제 취소(`CANCELED`) 이벤트가 네트워크 지연으로 인해 결제 성공(`DONE`) 이벤트보다 늦게 도착하거나 순서가 뒤바뀌는 현상 방어.
- `applySubscriptionUpdate`:
  - `sub.updatedAt > eventTimestamp` 인 경우 이전 시점의 구(old) 이벤트를 무시하여 상태 역행을 원천 방지함.

---

## 5. 결제 실패 및 장애 재조정 배치 (Reconciliation Job)

- `runBillingReconciliation`:
  - 매일 03:00 UTC에 Cloudflare Cron Trigger로 실행.
  - `PAST_DUE` 상태로 7일 이상 경과된 테넌트의 구독을 자동으로 `CANCELED` 처리하고 Pro 권한을 안전하게 회수(`plan = 'FREE'`).

---

## 6. 결제 로그 민감정보 마스킹 (Redaction Policy)

- 결제 로그 및 서버 에러 로그 출력 시 `sanitizeBillingLog` 강제 적용:
  - 시크릿 키: `test_sk_...` / `live_sk_...` -> `[REDACTED_SECRET_KEY]`
  - 빌링 키: `bln_...` -> `[REDACTED_BILLING_KEY]`
  - 카드 번호: 16자리 숫자 패턴 -> `[REDACTED_CARD_NUMBER]`
- 로그 파일이나 콘솔에 실제 결제 수단 정보가 평문으로 남지 않도록 100% 보증.
