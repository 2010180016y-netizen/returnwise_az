# ReturnWise 계산 규약 명세서 (CALCULATION_CONTRACT.md)

- **버전:** v1.0.0 (G0 잠금)
- **작성 일자:** 2026-11-03 (Asia/Seoul)
- **단일 진실원천(SSOT):** `docs/02_FINANCIAL_DOMAIN.md` 및 본 문서
- **티켓 ID:** T03 (비용산식·경계값 명세 고정)

---

## 1. 기본 원칙 및 계산 범위 정의

1. **기발생 매몰원가(Sunk Cost)의 엄격한 배제:**
   - 본 계산기는 쇼핑몰 전체 손익이나 마진율을 계산하는 도구가 아니다.
   - **"이미 주문 및 발송이 완료된 시점"**에서 고객의 반품·환불·교환 요청으로 인해 **새롭게 추가 발생하는 한계 비용(Marginal Additional Cost)**만을 비교한다.
   - 따라서 원주문 상품 매입비(사입가), 초기 포장비, 기지급 마케팅비 등 선택과 무관하게 이미 지출된 공통 원가는 선택지별 추가비용에 재합산하지 않는다.

2. **순회수가치(Recovered Item Net Value)의 보수적 산정:**
   - 회수 상품의 가치를 **원판매가나 매입원가로 자동 대체하는 것을 엄격히 금지**한다.
   - 상품의 개봉 여부, 훼손 정도, 재포장 비용, 폐기 가능성을 고려하여 판매자가 보수적으로 실현 가능하다고 판단한 **순가치(Net Realizable Value)**만을 입력받는다. 불확실한 경우 기본값은 **0원**이다.

---

## 2. 변수 정의 및 데이터 타입 규격

모든 금액 필드는 **대한민국 원화(KRW) 정수(Integer)**이며, 소수점·음수·NaN·Infinity는 거부된다.

| 변수명 | 한글 명칭 | 유효 범위 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| `refundAmount` | 구매자 환급액 | 0 ~ 1,000,000,000 | 미입력 | 구매자에게 실제 반환할 현금 총액 (초도 배송비 환불 포함 여부 사용자 명시). |
| `reverseShippingSellerCost` | 판매자 부담 회수 운임 | 0 ~ 100,000,000 | 0 | 판매자가 실제 추가로 택배사에 지출하는 회수 운임. 고객부담분 재가산 금지. |
| `handlingCost` | 검수/재포장/처리비 | 0 ~ 100,000,000 | 0 | 반품 입고 검수, 소독, 재포장 자재비, 또는 폐기 처리비. |
| `recoveredItemNetValue` | 회수 상품 순가치 | 0 ~ 1,000,000,000 | 0 | 회수된 상품의 재판매·처분으로 실현 가능한 순가치. (비현금 자산 가치). |
| `feeReversalCredit` | 확정 수수료 환급액 | 0 ~ 100,000,000 | 0 | 마켓/PG사로부터 실제로 취소·환급받을 것으로 **확정된** 결제·판매 수수료. |
| `additionalSellerCost` | 기타 추가 비용 | 0 ~ 100,000,000 | 0 | 특정 대안에서만 부가적으로 발생하는 기타 실증 비용. |
| `agreedPartialRefund` | 합의된 부분환급액 | 0 ~ `refundAmount` | 미입력 | 고객과 자발적으로 합의된 부분 환급 금액 (`KEEP_PARTIAL` 전용). |
| `replacementCost` | 교환 재발송 상품 원가 | 0 ~ 1,000,000,000 | 미입력 | 교환으로 새로 출고하는 새 상품의 조달/매입 원가 (`EXCHANGE` 전용). |
| `replacementOutboundShipping` | 교환 출고 운임 | 0 ~ 100,000,000 | 0 | 교환 상품을 고객에게 재발송할 때 판매자가 부담하는 운임 (`EXCHANGE` 전용). |

---

## 3. 두 핵심 출력 지표의 분리 공식

### 3.1 추가 현금지출 (`cashOutflow`)
- **개념:** 해당 처리 방식을 선택함으로써 판매자의 계좌에서 **추가로 빠져나가는 순수 현금 유출 총액**.
- **원칙:** 비현금 자산인 재고 가치(`recoveredItemNetValue`)는 절대 현금 유출에서 차감하지 않는다.
- **수식:**
  $$\text{cashOutflow} = (\text{현금성 환급액} + \text{판매자 추가 운임} + \text{처리비} + \text{기타 현금 비용}) - \text{feeReversalCredit}$$

### 3.2 순경제적 처리비용 (`economicCost`)
- **개념:** 현금 지출에서 회수한 재고 상품의 실현 가능 순가치를 차감한 **기회비용/순손실 추정액**.
- **수식:**
  $$\text{economicCost} = \text{cashOutflow} - \text{recoveredItemNetValue}$$
- **음수 처리 규정:**
  - `economicCost`는 음수(예: -9,000원)가 될 수 있으며, 이를 임의로 0원으로 클램핑하지 않는다.
  - 음수의 의미는 "회수가치가 추가 현금지출을 초과함"을 뜻하며, 화면에는 "순수익 보장"이 아닌 "순경제적 비용 -X원"으로 정확히 표기한다.

---

## 4. 4대 대안별 대수식 (Algebraic Formulas)

### 대안 1: 회수 후 전액환급 (`RETURN_FULL`)
- 상품을 다시 돌려받고 전액을 환불하는 표준 기준 대안.
$$\text{cashOutflow} = \text{refundAmount} + \text{reverseShippingSellerCost} + \text{handlingCost} + \text{additionalSellerCost} - \text{feeReversalCredit}$$
$$\text{economicCost} = \text{cashOutflow} - \text{recoveredItemNetValue}$$

### 대안 2: 회수 없는 전액환급 (`KEEP_FULL`)
- 회수 운임 및 검수 비용이 상품 잔존가치보다 커서 회수를 포기하고 전액 환불하는 대안.
$$\text{cashOutflow} = \text{refundAmount} + \text{additionalSellerCost} - \text{feeReversalCredit}$$
$$\text{economicCost} = \text{cashOutflow} \quad (\because \text{recoveredItemNetValue} = 0)$$

### 대안 3: 합의된 부분환급 (`KEEP_PARTIAL`)
- 고객이 경미한 불만을 수용하고 상품을 보유하는 대신 합의된 일부 금액만 환급하는 대안.
- **자격 게이트:** `voluntaryAgreementConfirmed && permittedByPolicyConfirmed && rightsNotRestrictedConfirmed` 필수.
$$\text{cashOutflow} = \text{agreedPartialRefund} + \text{additionalSellerCost} - \text{feeReversalCredit}$$
$$\text{economicCost} = \text{cashOutflow} \quad (\because \text{recoveredItemNetValue} = 0)$$

### 대안 4: 1:1 교환 처리 (`EXCHANGE`)
- 반품 대신 새 상품으로 맞교환을 진행하는 대안.
- **자격 게이트:** 고객의 교환 요청 또는 사전 합의 확인 필수.
$$\text{cashOutflow} = \text{replacementCost} + \text{reverseShippingSellerCost} + \text{replacementOutboundShipping} + \text{handlingCost} + \text{additionalSellerCost} - \text{feeReversalCredit}$$
$$\text{economicCost} = \text{cashOutflow} - \text{recoveredItemNetValue}$$

---

## 5. 입력 경계조건 및 에러 처리 규격

1. **미입력 vs 0원 엄격 구분:**
   - 필수 필드가 공백(`""`) 또는 `undefined`인 경우 계산을 일체 실행하지 않고 `MISSING_REQUIRED_INPUT` 오류를 반환한다.
   - 사용자가 `0`을 명시적으로 입력한 경우는 확인된 값으로 간주하여 유효 계산을 수행한다.
2. **금액 상한 검증:**
   - 단일 입력 필드의 상한은 `1,000,000,000원(10억 원)`이다. 10억 원을 초과하는 값은 파싱 단계에서 `MAX_AMOUNT_EXCEEDED` 에러를 발생시킨다.
3. **음수 및 비정상 숫자 차단:**
   - 음수(`-5000`), 소수(`12.5`), `NaN`, `Infinity`, 문자가 포함된 문자열(`"3000원"`) 등은 `INVALID_NUMBER_FORMAT`으로 차단한다. (단, 쉼표 천단위 구분기호 `"30,000"`는 정상 정수 `30000`으로 파싱 허용).

---

## 6. 수학적 불변식 (Invariants)

1. **결정성(Determinism):** 동일한 입력에 대해 산출 결과는 항상 바이트 단위까지 100% 동일해야 한다 (Pure function).
2. **단조증가성(Monotonicity):**
   - 판매자 운송비가 $X$원 증가하면, 해당 대안의 `cashOutflow`와 `economicCost`는 정확히 $X$원 증가한다.
   - 수수료 환급액이 $Y$원 증가하면, 해당 대안의 `cashOutflow`와 `economicCost`는 정확히 $Y$원 감소한다.
3. **분리 보존성:**
   - 회수 상품가치가 $Z$원 증가하면, `economicCost`만 정확히 $Z$원 감소하고 `cashOutflow`는 1원도 변동하지 않는다.
4. **전가 방지성:**
   - 고객부담 운송비는 판매자 추가 비용에 절대 합산되지 않는다.
