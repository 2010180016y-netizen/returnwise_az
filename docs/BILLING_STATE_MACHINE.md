# ReturnWise 정기결제 상태머신 명세서 (BILLING_STATE_MACHINE.md)

- **제품명**: ReturnWise Pro (정기결제 구독 엔진)
- **적용 버전**: v1.0.0 Pro 결제 상태머신
- **진행 단계**: G6 / 결제 상태머신 및 실패 복구 설계
- **최종 판정**: **PASS**

---

## 1. 6대 결제 상태 정의 (State Definitions)

| 상태 코드 | 상태명 | 설명 및 허용 권한 | Pro 기능 허용 여부 |
|---|---|---|---|
| **`UNPAID`** | **미결제** | 초기 계정 생성 상태, 결제 수단 미등록 | 불허 (무료 단건만 허용) |
| **`TRIAL`** | **체험** | 14일 무료 체험 기간 (카드 등록 불필요) | **전면 허용** |
| **`ACTIVE`** | **정상 활성** | 정기결제 승인 완료, 정상 구독 중 | **전면 허용** |
| **`PAST_DUE`** | **결제 연체 (미납)** | 잔액 부족/카드 만료로 결제 실패, 유예 기간(Grace Period 7일) | 제한적 허용 (경고 배너 노출) |
| **`CANCELED`** | **해지 / 만료** | 사용자가 구독 취소함, 구독 주기 만료 시점 도달 | 불허 (읽기 전용 30일 후 차단) |
| **`REFUNDED`** | **환불 완료** | 7일 이내 청약철회 또는 중도 환불 승인 상태 | 즉시 불허 (무료 전환) |

---

## 2. 상태 전이 다이어그램 (State Transition Flowchart)

```text
                  [ UNPAID (미결제) ]
                    │            │
      가입 즉시 체험 │            │ 즉시 카드 등록 결제
                    ▼            ▼
             [ TRIAL (체험) ] ──▶ [ ACTIVE (정상 활성) ] ◀──┐
                    │                    │   ▲              │
       체험 종료    │          정기결제  │   │              │
       미결제 시    │          실패 시   │   │ D+1~D+7      │
                    ▼                    ▼   │ 결제 성공    │
              [ CANCELED ] ◀───── [ PAST_DUE (미납) ]       │
              (해지/종료)   재시도 초과          │          │
                    ▲                           ▼          │
                    │               [ REFUNDED (환불) ]     │
                    └───────────────────────────┴───────────┘
                                 재구독 시 ACTIVE로 복귀
```

---

## 3. 이벤트별 전이 규칙 (Transition Matrix)

| 출발 상태 (From) | 이벤트 (Event) | 도착 상태 (To) | 실행 액션 및 부수 효과 |
|---|---|---|---|
| `UNPAID` | `START_TRIAL` | `TRIAL` | 14일 만료일(`trialEndsAt`) 설정, Pro 권한 활성화 |
| `UNPAID` / `TRIAL` | `BILLING_SUCCESS` | `ACTIVE` | 빌링키 저장, 다음 결제일(D+30) 스케줄링, 세금계산서 발행 |
| `ACTIVE` | `BILLING_FAILURE` | `PAST_DUE` | D+1 재시도 예약, 셀러 이메일로 결제 실패 알림 발송 |
| `PAST_DUE` | `RETRY_SUCCESS` | `ACTIVE` | 미납금 정산 완료, 다음 정기결제일 갱신, 알림 해제 |
| `PAST_DUE` | `GRACE_EXPIRED` | `CANCELED` | 7일간 3회 재시도 모두 실패 시 구독 자동 해지 |
| `ACTIVE` | `USER_CANCEL` | `CANCELED` | 당기 결제 종료일까지 Pro 권한 유지 후 자동 종료 |
| `ACTIVE` / `CANCELED`| `PROCESS_REFUND` | `REFUNDED` | 토스 결제 취소 API 호출, Pro 권한 즉시 회수 |

---

## 4. 멱등성 키(Idempotency Key) 및 자동 재시도 정책

### 4.1 멱등성 보장 (Idempotency Contract)
- 결제 승인 요청 시 고유한 멱등성 키를 강제 생성하여 네트워크 중복 호출 시에도 이중 결제를 원천 차단:
  ```text
  Idempotency-Key: bill_{tenantId}_{periodStartDateMs}_{attemptCount}
  ```
- 동일 멱등키로 재호출 시 토스페이먼츠 및 ReturnWise 서버는 기존 승인 결과를 그대로 반환함.

### 4.2 스마트 재시도 스케줄러 (Smart Retry Schedule)
- 1회차 실패 (D-Day): 토스 결제 실패 웹훅 수신 즉시 `PAST_DUE` 전이, 셀러에게 "결제 카드 잔액/한도 확인 안내" 발송.
- 2회차 재시도 (D+1): 24시간 후 자동 재승인 시도.
- 3회차 재시도 (D+3): 48시간 후 2차 재승인 시도.
- 4회차 최종 시도 (D+7): 96시간 후 최종 재승인 시도.
- 최종 실패 시: `CANCELED` 상태로 전환하고 Pro 유료 권한을 안전하게 회수함.

---

## 5. 결제 실패 및 엣지케이스 안전 방어

1. **카드 유효기간 만료 사전 감지**:
   - 정기결제일 7일 전에 카드 만료월을 검사하여 만료 예정인 경우 "결제 수단 갱신 안내" 이메일 발송.
2. **웹훅 중복 수신 방어**:
   - 동일한 웹훅 이벤트(`paymentKey`, `transactionKey`)가 다중 수신되더라도 멱등 처리하여 상태를 단 1회만 전이.
3. **분실/도난 카드 즉각 대응**:
   - `REJECTED_CARD` 응답 시 재시도를 즉시 중단하고 카드 갱신 화면으로 안내.
