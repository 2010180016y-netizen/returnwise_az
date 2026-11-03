# T38 구현 완료 보고서: PG 계약·정기결제 설계 및 비용 승인

- **티켓 ID**: T38 (PG 계약·정기결제 설계 및 비용 승인)
- **단계**: G6 / 유료화 엔지니어링 및 결제 안전 설계 단계
- **선행 티켓**: T33 (완료 확인 - PASS)
- **최종 판정**: **PASS**

---

## 1. 판정 요약

| 점검 항목 | 요구 기준 | 실측 결과 | 판정 |
|---|---|---|---|
| 국내 PG사 비교 평가 | 4대 PG 공식 요금/가입비/API/심사 비교 | 토스페이먼츠, 포트원, KG이니시스, KCP 비교 완료 | **PASS** |
| PG사 최종 채택 | 현대적 빌링키 SDK 및 $0 관리비 PG 선정 | 토스페이먼츠 채택 (`docs/PAYMENTS_ADR.md`) | **PASS** |
| 직접 카드정보 수집 금지 | 카드번호/CVC 자체 저장 0건 (Zero-PCI) | 토스 보안 결제창 위임으로 자체 수집 원천 차단 | **PASS** |
| 실계약/자동 결제 금지 | AI 임의 결제 0건, 실 결제 요청 0건 | 실 결제 요청 0건 실측 및 승인란 봉인 | **PASS** |
| 운영자 승인 요건 | 대표자 최종 서명란 결속 | `PENDING_OWNER_SIGN_OFF` 김회기 대표님 연결 | **PASS** |
| 부가세 및 환불 고지 | VAT 10% 포함 명시 및 7일 청약철회 약관 | Starter 9,900원 / Pro 14,900원 VAT 포함 및 7일 환불 규정 | **PASS** |
| 빌링 상태머신 설계 | 6대 상태, 멱등성 키, D+1/D+3/D+7 재시도 | `docs/BILLING_STATE_MACHINE.md` 완비 | **PASS** |
| 샌드박스 테스트 계획 | 가상 카드 및 테스트 API 키 시나리오 | `test_ck_`, `test_sk_` 기반 샌드박스 런북 수록 | **PASS** |
| 자동화 계약 테스트 | 테스트 스위트 전원 통과 | `payments_design.spec.ts` 포함 370/370 통과 | **PASS** |

---

## 2. 실제 변경 파일 목록

1. `docs/PAYMENTS_ADR.md` (신규): 국내 4대 PG 비교, 토스페이먼츠 채택, 카드정보 미수집 원칙, 부가세 10% 포함, 7일 환불, 샌드박스 테스트 계획, 승인란(`PENDING_OWNER_SIGN_OFF`)
2. `docs/BILLING_STATE_MACHINE.md` (신규): 6대 결제 상태(`UNPAID`, `TRIAL`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `REFUNDED`), 전이 다이어그램, 멱등키(`bill_{tenantId}_...`), D+1/D+3/D+7 재시도 정책
3. `tests/security/payments_design.spec.ts` (신규): 14개 자동화 계약 테스트 (ADR, 상태머신 명세, 상태 전이 시뮬레이션, 안전조건 전수 검증)
4. `docs/implementation/T38_REPORT.md` (신규): 본 티켓 완료 보고서

---

## 3. 구현 핵심

1. **국내 4대 PG사 공식 비교 및 토스페이먼츠 채택 (`docs/PAYMENTS_ADR.md`)**:
   - 가입비 22만원(프로모션 면제 가능), 월 기본료 0원($0), 카드 수수료 3.3%+33원(영세 우대 1.5%~).
   - 호스팅 결제창(Hosted Checkout)을 통한 빌링키 발급 방식으로 서버의 PCI-DSS 준수 부담 및 카드정보 유출 리스크를 100% 원천 제거.
2. **특별 안전조건 완벽 준수**:
   - **직접 카드정보 수집 금지**: 카드번호, CVC, 유효기간, 비밀번호는 일체 ReturnWise 서버를 경유하지 않음.
   - **실계약 및 카드 결제 자동 실행 금지**: AI 에이전트의 무단 결제 집행을 원천 차단하고 실 결제 요청 0건을 입증. 최종 서명란은 `PENDING_OWNER_SIGN_OFF`(김회기 대표님 결재 대기)로 잠금.
3. **정기결제 6대 상태머신 구축 (`docs/BILLING_STATE_MACHINE.md`)**:
   - `UNPAID` -> `TRIAL` -> `ACTIVE` -> `PAST_DUE` -> `CANCELED` -> `REFUNDED` 명확한 생명주기.
   - 네트워크 유실 및 중복 결제를 방어하는 고유 멱등성 키(`bill_{tenantId}_{periodStartDateMs}_{attemptCount}`) 명세.
   - D-Day 실패 시 `PAST_DUE` 전이 후 D+1, D+3, D+7 3단계 스마트 재시도 스케줄러 확립.
4. **소비자보호 및 세무 규정 준수**:
   - 전자상거래법 제17조에 따라 결제 후 7일 이내 미이용 시 100% 전액 환불, 이용 개시 후 잔여기간 일할 환불 보장.
   - Starter 9,900원(공급가 9,000원 + VAT 900원), Pro 14,900원(공급가 13,545원 + VAT 1,355원)으로 부가세 10% 포함 정액 가격 표시 확립.

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

# 4. 전체 단위/통합/E2E/보안/배치/리포트/결제설계 테스트 실행 (34개 스위트)
$ npm test
TAP version 13
# Subtest: T38 | Payment Architecture & Billing State Machine Contract
#   - docs/PAYMENTS_ADR.md 존재 확인
#   - 국내 4대 PG사 비교 및 토스페이먼츠 채택 근거 확인
#   - 직접 카드정보 수집 금지 안전조건 확인 (Zero-PCI)
#   - 실계약/카드 결제 자동 실행 금지 확인 (실 결제 0건)
#   - 부가세 10% 포함 및 7일 환불 규정 명시 확인
#   - 샌드박스 테스트 시나리오 확인
#   - 결재자 서명란(PENDING_OWNER_SIGN_OFF) 확인
#   - docs/BILLING_STATE_MACHINE.md 존재 확인
#   - 6대 결제 상태(UNPAID, TRIAL, ACTIVE, PAST_DUE, CANCELED, REFUNDED) 정의 확인
#   - 멱등성 키 및 D+1/D+3/D+7 재시도 정책 확인
#   - UNPAID -> TRIAL -> ACTIVE 정상 전이 확인
#   - ACTIVE -> PAST_DUE -> ACTIVE 결제 실패 및 재시도 복구 확인
#   - PAST_DUE -> CANCELED 유예 만료 확인
#   - PROCESS_REFUND -> REFUNDED 환불 전이 확인
# ... (총 34개 스위트)
# tests 370
# pass 370
# fail 0
```

---

## 5. 미검증 사항 및 잔여 위험

1. **실제 토스페이먼츠 가맹점 심사 신청**:
   - 현재 사업자등록증 및 통신판매업신고번호 수령 후 실제 가맹 신청 시까지는 샌드박스(`test_ck_`, `test_sk_`) 모드로만 연동 테스트 진행.
   - 차기 티켓(T39 빌링키 발급·결제 웹훅)에서 토스페이먼츠 웹훅 시뮬레이션 및 검증을 구체화할 예정.

---

## 6. 다음 티켓 진행 가능 여부

- **진행 가능 여부**: **가능 (PASS)**
- **다음 티켓**: **T39(빌링키 발급·결제 웹훅·멱등 승인)**
