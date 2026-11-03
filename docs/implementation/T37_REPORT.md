# T37 구현 완료 보고서: 월간 리포트·사용량 제한

- **티켓 ID**: T37 (월간 리포트·사용량 제한)
- **단계**: G6 / 유료화 엔지니어링 및 요금제 경계 단계
- **선행 티켓**: T35, T36 (전원 완료 확인 - PASS)
- **최종 판정**: **PASS**

---

## 1. 판정 요약

| 점검 항목 | 요구 기준 | 실측 결과 | 판정 |
|---|---|---|---|
| 단건 합계 일치성 | 집계 fixture가 단건 합계와 1원 단위 일치 | 10건 단건 합계와 월간/마켓별/옵션별 100% 일치 | **PASS** |
| 서버측 Quota 가드 | 플랜별 한도 초과 시 429 차단 | Starter 월 100건 초과 시 429 차단 실측 | **PASS** |
| 플랜 기능 경계 | 무료 사용자 Pro 기능 403 차단 | Free 유저의 리포트/배치 접근 403 차단 실측 | **PASS** |
| 세무 증빙 내보내기 | Pro 전용 세무 증빙 CSV 출력 | Pro 허용 및 Starter/Free 403 차단 실측 | **PASS** |
| 순수 원화 정수 산정 | 환율/세금 혼합 배제 | KRW 1원 단위 정수 통일, 외화 혼합 0건 | **PASS** |
| 특별 안전조건 엄수 | 현금수익 오인 표현 엄격 배제 | '영업이익/순수익' 0건, '손실절감액' 보수적 표기 | **PASS** |
| 자동화 리포트 테스트 | 테스트 스위트 전원 통과 | `monthly_report.test.ts` 포함 356/356 통과 | **PASS** |

---

## 2. 실제 변경 파일 목록

1. `src/features/reports/types.ts` (신규): `PlanTier`, `PlanQuota`, `MarketBreakdown`, `OptionBreakdown`, `MonthlyReportSummary` 타입 정의
2. `src/features/reports/reportAggregator.ts` (신규): 월간 손실 집계기 (1원 단위 정수 합계, 마켓/옵션 그룹핑, 손실절감액 산출, 세무 CSV 내보내기)
3. `server/usage/quotaGuard.ts` (신규): 서버측 사용량 및 플랜 경계 가드 (`assertCanAccessMonthlyReport`, `assertCanExportTaxProof`, `assertCanExecuteBatch`)
4. `tests/reports/monthly_report.test.ts` (신규): 8개 단위 계약 테스트 (단건 합계 일치, Free 403 차단, Starter 100건 429 한도, Pro 무제한, 안전문구 검증)
5. `docs/implementation/T37_REPORT.md` (신규): 본 티켓 완료 보고서

---

## 3. 구현 핵심

1. **1원 단위 정수 합계 무결성 (`reportAggregator.ts`)**:
   - `totalItemPrice`, `totalCashOutflow`, `totalEconomicCost`, `totalLossMitigated` 전 지표가 단건 케이스들의 합계와 1원의 오차도 없이 100% 일치 (`sum(items) === total`).
   - 마켓별(스마트스토어, 쿠팡 등) 및 4대 처리방식별(C01, C02, C03, C15) 소계의 합 또한 전체 총합과 완벽히 일치.
2. **서버측 플랜 경계 및 Quota 통제 (`server/usage/quotaGuard.ts`)**:
   - **Free (무료)**: 단건 1페이지 계산기 영구 무료, 월간 리포트 및 대용량 배치 접근 차단 (`403 PRO_PLAN_REQUIRED`).
   - **Starter (9,900원)**: 월 100건 CSV 배치 한도 초과 시 `429 QUOTA_EXCEEDED` 차단, 월간 기본 리포트 조회 허용, 세무 증빙 출력 차단 (`403 PRO_TIER_REQUIRED`).
   - **Pro (14,900원)**: 무제한 배치 계산 및 세무 정산 리포트 CSV 출력 전면 허용.
3. **특별 안전조건 완벽 준수 (수익 오인 표현 원천 배제)**:
   - "Pro 관련 현금수익을 사용자의 실제 수익으로 오인시킬 표현 금지" 안전조건을 철저히 엄수.
   - 반품비 절감액을 판매자의 '영업이익', '순이익', '현금매출'로 왜곡 포장하지 않고, **'손실 절감액(Loss Mitigated)'**, **'비용 방어액'** 등 보수적 재무 용어로만 표기.
4. **순수 원화 정수 단일화**:
   - 환율이나 세전/세후 혼선을 없애고 순수 대한민국 원화(KRW) 정수 체계로 통일.

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

# 4. 전체 단위/통합/E2E/보안/배치/리포트 테스트 실행 (33개 스위트)
$ npm test
TAP version 13
# Subtest: T37 | Monthly Report & Usage Quota Contract
#   - 10건 단건 합계와 월간/마켓별/옵션별 정수 합계 100% 일치 (sum === total)
#   - 무료(FREE) 사용자의 월간 리포트 접근 403 차단
#   - 무료(FREE) 사용자의 대량 CSV 계산 403 차단
#   - Starter 사용자 100건 한도 초과(110건 요청) 시 429 차단
#   - Starter 사용자 한도 내(100건) 요청 허용
#   - Starter 사용자 세무 증빙 내보내기 403 차단
#   - Pro 사용자 무제한 배치 및 세무 리포트 허용
#   - 특별 안전조건: '영업이익/순수익/현금매출' 배제 및 '손실절감액' 정직 표기 실측
# ... (총 33개 스위트)
# tests 356
# pass 356
# fail 0
```

---

## 5. 미검증 사항 및 잔여 위험

1. **실제 토스 결제 상태 웹훅 연동**:
   - 현재 플랜별 권한 및 사용량 가드는 완비되었으며, 차기 티켓(T38 PG 계약 및 T39 결제 웹훅)과 연동하여 실제 구독 결제 상태와 동기화될 예정.

---

## 6. 다음 티켓 진행 가능 여부

- **진행 가능 여부**: **가능 (PASS)**
- **다음 티켓**: **T38(PG 계약·정기결제 설계 및 비용 승인)**
