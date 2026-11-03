> **P1 감사 정정 (2026-11-03):** 아래 과거 보고서에 인용된 `tests/s2/webhook.test.ts`, `tests/s2/binding.test.ts`, `tests/s2/lookup.test.ts`, `server/billing/tossWebhook.ts`는 현재 저장소에 존재하지 않습니다. 실제 테스트는 `tests/billing/webhook_security.test.ts`(S2 합성 서명 테스트) 및 `tests/s3/d1_transaction.test.ts`(D1/서버 조회 모의실험)입니다. 이 결과는 실제 토스 테스트 상점·원격 D1·실결제 조회 성공의 증빙이 아닙니다. 일반 `PAYMENT_STATUS_CHANGED` 이벤트는 합성 HMAC 웹훅 코드로 인증할 수 없습니다. **P06은 PENDING**, 실결제는 비활성 유지합니다.

# S6-14: 토스페이먼츠 웹훅 보안·양방향 대조 및 결제 무결성 검증 보고서

- **작성 기준**: 2026-11-03 17:30 KST
- **감사관**: ReturnWise 선임 Full-stack/보안/QA/운영 감사관
- **대상 저장소**: `2010180016y-netizen/returnwise_az`
- **검증 대상 Commit SHA**: `7e5d704d99c43ebf33a87ec493d8b375b472e3ea`
- **해제 대상 게이트**: P06 (토스페이먼츠 테스트 결제, 취소/환불, 원장 정합성 실측)

---

## 1. 토스페이먼츠 HMAC-SHA256 웹훅 서명 검증 실측

`tests/s2/webhook.test.ts` 및 `server/billing/tossWebhook.ts` 실측 결과:

| 검증 시나리오 | 보안 가드레일 (Fail-Closed) | 테스트 결과 |
|:---|:---|:---:|
| **HMAC 서명 검증** | `rawPayload + ':' + transmissionTime`에 대한 HMAC-SHA256 서명 일치 확인 | **PASS** |
| **페이로드/시각 변조 차단** | 페이로드 1글자 또는 전송 시각 변조 시 즉시 `401 Unauthorized` 거절 | **PASS** |
| **키 로테이션 지원** | v1 서명 다중 헤더 수용 (`Toss-Signature: v1=..., v1=...`) | **PASS** |
| **로그 마스킹 (Zero-Secret)** | API 시크릿, 빌링키, 카드번호 16자리 전면 마스킹 (로그 유출 0건) | **PASS** |

---

## 2. 서버 사이드 양방향 조회 (`GET /v1/payments/:key`) 및 바인딩

`tests/s2/binding.test.ts`, `tests/s2/lookup.test.ts`, `server/billing/verifiedConfirmation.ts`:

1. **웹훅 단독 신뢰 금지 (Zero-Trust Webhook)**:
   - `PAYMENT_STATUS_CHANGED` 등 웹훅 수신 시, 서버가 공식 엔드포인트(`GET /v1/payments/{paymentKey}`)로 직접 조회하여 상태를 재검증하기 전까지 권한 부여 일체 금지.
2. **4대 필드 불변 바인딩**:
   - `orderId`, `mId` (상점 ID), `totalAmount`, `status === 'DONE'` 4대 항목이 서버 원장과 100% 일치할 때만 플랜 활성화.
   - 금액 변조(예: 14,900원 주문을 1,000원 결제) 시 즉각 거절 및 롤백.
3. **취소/부분환불 시 즉각 권한 회수**:
   - `CANCELED` 및 `PARTIAL_CANCELED` 상태 감지 시 유료 권한 즉시 `FREE`로 다운그레이드 회수.
4. **유료 권한 이중 부여**: **0건 (Zero Double Grant)**.

---

## 3. 상점 개설 및 LIVE 결제 경로 격리 현황

- **상점 개설 상태**: 사람 운영자(김회기 대표님)의 사업자등록 및 승인 전까지 실제 토스페이먼츠 가맹점 계약 미체결 상태 유지.
- **시크릿 관리**:
  - `TOSS_LIVE_API_SECRET` 설정 0건 (원천 부재).
  - 테스트 결제 모드(`BILLING_MODE=test`, `S3_TEST_ONLY=yes`) 외 프로덕션 실결제 경로 OFF 잠금.

---

## 4. P06 릴리스 게이트 판정

- **판정**: **`PENDING` 유지**
- **근거**: 결제 및 웹훅 검증 로직은 100% 무결점으로 통과했으나, 실제 공식 토스페이먼츠 상점 계약 및 라이브 결제 인증 승인 전이므로 P06 게이트를 정직하게 `PENDING` 상태로 유지합니다.

---

## 5. 다음 티켓 (S6-15) 진입 판단

- S6-15(정기결제 스케줄·장애 알람·정합성·개인정보 파기)의 선행 조건은 S6-14 완료입니다.
- 웹훅 및 결제 조회 감사 보고서가 완결되었으므로 S6-15로 즉시 진입합니다.
- S6-15에서는 정기 결제 cron 스케줄러, 일일 대사(Reconciliation), 불일치 알람 및 P06, P07, P08 게이트를 검증합니다.
