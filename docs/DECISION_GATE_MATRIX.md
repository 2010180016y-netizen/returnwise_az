# ReturnWise 의사결정 차단 게이트 매트릭스 (DECISION_GATE_MATRIX.md)

- **버전:** v1.0.0 (G0 잠금)
- **작성 일자:** 2026-11-03 (Asia/Seoul)
- **티켓 ID:** T02 (법률·마켓 정책 출처 등록 및 차단 매트릭스)

---

## 1. Fail-closed 원칙 및 게이트 아키텍처

ReturnWise의 모든 대안 비교 로직은 **Fail-closed(불확실 시 차단)** 원칙을 따른다:
1. 입력 데이터나 법적 권리, 고객 동의 여부가 확실하지 않으면 **"적법하다"고 추정하지 않는다**.
2. 조건이 확인되지 않은 대안은 추천 순위(Ranking)에서 즉시 제외되며, `BLOCKED_OR_REVIEW` 상태로 격리된다.
3. 판매자 화면에는 법률적 추천이 아닌 **"조건 충족 대안 중 비용 시뮬레이션 결과"**로만 노출된다.

```
[입력 데이터 + 상황 플래그 수집]
               ↓
   [Gate 1: 귀책 사유 및 반품비 부담 적격성 검증] ── (위반 시) ➔ 고객 운임 전가 원천 차단 (L02)
               ↓
   [Gate 2: 고객 요청 및 교환 동의 검증] ─────── (미동의 시) ➔ EXCHANGE 대안 비활성화 (L06)
               ↓
   [Gate 3: 부분환불 3대 합의/규정 검증] ───────── (하나라도 미충족 시) ➔ KEEP_PARTIAL 추천 제외 (L03, L04, L05)
               ↓
   [Gate 4: 특례 품목 및 정책 검증 만료 체크] ───── (해당 시) ➔ 전문 검토 필요 / 안전 모드 전환 (L07, L08)
               ↓
[적격(ELIGIBLE) 대안만 순경제적 비용 순위 비교 표시]
```

---

## 2. 대안별 의사결정 게이트 매트릭스

| 대안 코드 | 대안 명칭 | 필수 검증 게이트 (Prerequisite Gates) | 통과 시 상태 (`ELIGIBLE`) | 실패/미확인 시 상태 (`BLOCKED_OR_REVIEW`) | 차단 시 화면 노출 메시지 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`RETURN_FULL`** | 회수 후 전액환급 | - 기본 기준 대안<br>- 판매자 귀책 시 판매자가 운임 부담 | `ELIGIBLE` (기본 비교군 포함) | `REVIEW_REQUIRED` (귀책 사유 불명 시) | "반품 귀책 사유를 확인해 주세요." |
| **`KEEP_FULL`** | 회수 없는 전액환급 | - 판매자 자발적 회수 포기<br>- 특례 폐기 규정 미해당 | `ELIGIBLE` (비교군 포함) | `REVIEW_REQUIRED` (특례 품목 등) | "플랫폼 반품 프로세스상 회수 생략 가능 여부 확인 필요" |
| **`KEEP_PARTIAL`** | 합의된 부분환급 | 1) `voluntaryAgreementConfirmed === true`<br>2) `permittedByPolicyConfirmed === true`<br>3) `rightsNotRestrictedConfirmed === true` | `ELIGIBLE` (조건부 비교군 포함) | **`BLOCKED` (추천 제외)** | **"고객 자발적 합의 및 마켓 정책 확인 전까지 추천 제외"** |
| **`EXCHANGE`** | 1:1 교환 처리 | - `buyerRequest === 'EXCHANGE'` 또는 `buyerAgreedExchange === true` | `ELIGIBLE` (교환 비교군 포함) | **`BLOCKED` (추천 제외)** | **"고객의 교환 동의/요청이 확인되지 않아 추천 제외"** |

---

## 3. 상황별 조합(Truth Table) 및 판정 매트릭스

| 사유 (`reason`) | 고객 요청 (`buyerRequest`) | 동의/정책 확인 상태 | `RETURN_FULL` | `KEEP_FULL` | `KEEP_PARTIAL` | `EXCHANGE` | 최저비용 추천 허용 여부 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **단순변심** | 환불 | 3대 조건 미확인 | ELIGIBLE | ELIGIBLE | **BLOCKED** | **BLOCKED** | 충족된 2개 대안 중 비교 |
| **단순변심** | 환불 | 3대 조건 모두 확인 | ELIGIBLE | ELIGIBLE | **ELIGIBLE** | **BLOCKED** | 충족된 3개 대안 중 비교 |
| **단순변심** | 교환 | 교환 요청 확인 | ELIGIBLE | ELIGIBLE | **BLOCKED** | **ELIGIBLE** | 교환군 분리 비교 |
| **판매자 귀책** | 환불 | 판매자 운임부담 0원 입력 | **INVALID** | ELIGIBLE | **BLOCKED** | **BLOCKED** | **계산 차단 (운임 전가 오류 L02)** |
| **판매자 귀책** | 환불 | 정당 운임 입력 + 합의 확인 | ELIGIBLE | ELIGIBLE | **ELIGIBLE** | **BLOCKED** | 충족된 3개 대안 중 비교 |
| **사유 불명** | 불명 | 미확인 | REVIEW | REVIEW | **BLOCKED** | **BLOCKED** | **전체 추천 차단 (L01)** |

---

## 4. 8대 안전/적법성 테스트 시나리오 (L01~L08) 매핑

| 시나리오 ID | 시나리오 명칭 | 트리거 조건 | 기대 동작 (Expected Gate Behavior) | 검증 기준 |
| :--- | :--- | :--- | :--- | :--- |
| **L01** | 귀책 사유 미확인 차단 | `reason === 'UNKNOWN_REASON'` | 모든 대안에 '최저비용 추천' 배지 부착 차단, `확인 필요` 상태 노출. | 추천 텍스트 노출 0건 |
| **L02** | 판매자 귀책 고객 전가 차단 | `SELLER_FAULT`인데 `reverseShippingSellerCost === 0` (고객부담 설정) | 입력 폼 레벨에서 경고 및 계산 진행 차단 (전자상거래법 제18조 제9항 위반). | 계산 차단 및 필드 에러 |
| **L03** | 부분환불 고객 합의 부재 차단 | `voluntaryAgreementConfirmed === false` | `KEEP_PARTIAL` 상태를 `BLOCKED`로 전환, 순위 비교군에서 완전히 제외. | 순위 비교군 제외 |
| **L04** | 플랫폼 규정 불명 차단 | `permittedByPolicyConfirmed === false` | `KEEP_PARTIAL` 상태를 `BLOCKED`로 전환. | 순위 비교군 제외 |
| **L05** | 권리 비침해 불명 차단 | `rightsNotRestrictedConfirmed === false` | `KEEP_PARTIAL` 상태를 `BLOCKED`로 전환. | 순위 비교군 제외 |
| **L06** | 교환 강요 차단 | 고객이 환불 요청(`buyerRequest === 'REFUND'`) | `EXCHANGE` 상태를 `BLOCKED`로 전환하여 환불 고객에게 교환 유도 차단. | 순위 비교군 제외 |
| **L07** | 특례 품목 전문 검토 안내 | 식품/위생/주문제작 등 특례 플래그 On | "전문 법률/마켓 분쟁 조정 기준 확인 필요" 안내 배너 상시 노출. | 안내 배너 렌더링 |
| **L08** | 정책 검증 만료 안전모드 | 검증 기준일로부터 정책 변경 탐지 시 | 신규 정책 재검증 전까지 특수 대안 자동 비활성화(기본 전액환급 계산기만 유지). | 안전 모드 동작 |

---

## 5. 법률 전문 검토 미완료 시 '확인 필요' 표시 규격

UI 상에서 미확인 대안은 다음과 같은 시각적·문구적 규격으로 표시된다:
1. **스타일:** 배경색 연회색(`bg-slate-100`), 테두리 점선(`border-dashed border-slate-300`), 텍스트 뮤트(`text-slate-400`).
2. **배지:** 주황색 경고 배지 `[확인 필요]`.
3. **설명문구:** "소비자 자발적 합의 및 마켓 판매자 약관 검토가 완료되지 않아 비교에서 제외되었습니다."
4. **추천 방어:** 어떠한 경우에도 `[추천]` 또는 `[최저 비용]` 라벨이 `BLOCKED` 대안에 붙지 않도록 불변식 강제.
