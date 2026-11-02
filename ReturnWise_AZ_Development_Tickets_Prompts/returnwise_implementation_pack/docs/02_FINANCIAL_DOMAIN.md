# 02. 계산 규격 — 반드시 코드와 테스트의 단일 진실원천으로

## 목적과 표현
매출·이익 전체를 계산하는 툴이 아니다. **이미 주문이 발생한 시점부터** 각 처리방법 때문에 추가로 발생하는 비용을 비교한다. 따라서 '원주문 상품 매입비' '기존 결제 완료 금액' 등 공통/기발생 원가는 선택지별 추가비용에 또 더하지 않는다. 재고 회수가치 또한 실현 가능성이 불확실하면 0원으로 보수적으로 입력한다.

## 금액, 통화, 정수
- 모든 금액 KRW 정수 원, 음수·NaN·Infinity 금지; 상한액 1,000,000,000원(변경 가능 상수, 근거 문서화), 공백/쉼표 허용하되 입력 안정성 검사.
- 입력 숫자 JS Number 정수 범위 내, 계산 마지막 반올림 규칙 정책화. 초기에는 모든 금액 원 단위 정수만 처리.
- '미입력'과 '0원'을 구분. 0원은 사용자가 확인한 숫자다.
- `refundAmount` = 구매자에게 실제 돌려주는 모든 현금 합계(원거래의 배송비 환불 포함 여부를 사용자에게 명시).
- `reverseShippingSellerCost` = 판매자가 실제 추가 부담하는 회수 운임(고객부담 비용을 다시 더하지 않음).
- `handlingCost` = 검수/재포장/폐기/CS에 따른 처리방식별 증가 비용.
- `recoveredItemNetValue` = 회수 상품의 처분/재판매/활용으로 실현 가능하다고 보수적으로 보는 **순가치**. 원판매가도, 매입원가도 자동 대입하지 않음. 회수 후 재판매 관련 추가 비용이 있다면 이 값에서 차감하고 별도 항목에 재가산하지 않음.
- `feeReversalCredit` = 해당 처리 방식에서 실제 환급/취소될 것으로 **확인된** 플랫폼 결제·판매수수료. 근거 없는 자동 계산 금지. 기본 0원.
- `additionalSellerCost` = 기타 해당 방식으로만 생기는 실증 가능한 비용.

## 두 출력지표
1. **추가 현금지출** (`cashOutflow`): 사용자 지급/운송/처리/추가구입/재발송 등 미래 현금 유출에서 확정 수수료 회수액 차감. 재고 회수가치(비현금)는 차감하지 않는다.
2. **순경제적 처리비용** (`economicCost`): `cashOutflow - recoveredItemNetValue`. 음수도 의미 있을 수 있으므로 임의로 0으로 클램핑하지 않는다. 음수는 '회수가치가 현금지출보다 큼'이라는 비용지표이며 순이익 보장 표현 금지.

## 방법별 기본식
- `RETURN_FULL` : `cash = fullRefund + sellerPaidReverseShipping + handling + other - confirmedFeeReversal`; `economic = cash - recoveredItemNetValue`.
- `KEEP_FULL` : `cash = fullRefund + keepOptionOther - confirmedFeeReversal`; `economic = cash` (회수 없음).
- `KEEP_PARTIAL` : `cash = agreedPartialRefund + partialOptionOther - confirmedFeeReversal`; `economic = cash`; **고객의 명시적·자발적 합의/규정상 허용 근거를 확인하지 않으면 비교 제외**.
- `EXCHANGE` : `cash = replacementCost + returnShippingSellerPaid + replacementOutboundSellerPaid + exchangeHandling + customerCompensation + other - confirmedFeeReversal`; `economic = cash - recoveredOriginalItemNetValue`. 원주문 환불이 발생하는 교환은 추가 환불액을 명시적으로 포함. 이미 발생한 원상품 매입비를 중복 가산하지 말 것.

## 이용자 보호 및 비교군
- `decisionContext`: `reason`(`buyer_remorse`/`seller_fault`/`different_from_description`/`unknown`), `buyerRequest`(`refund`/`exchange`/`unknown`), `platform`(`independent`/`naver`/`coupang`/`other`), `policyReviewed`(boolean), `rightsReviewed`(boolean).
- `RETURN_FULL`을 기준 대안으로 둔다. 단, 실제 법률 및 플랫폼 사실관계를 몰라 자동 '적법함' 판정하지 않는다.
- 부분환불 옵션: `voluntaryAgreementConfirmed && permittedByPolicyConfirmed && rightsNotRestrictedConfirmed` 인 경우에만 `eligible`. 하나라도 false/unknown이면 `blocked_or_review`.
- 교환은 사용자가 교환을 요청하거나 적법하게 선택한 경우에만 유효 비교군. '환불 요청 사용자에게 교환을 강요'하지 않는다.
- 회수 없는 전액환불은 플랫폼 절차 및 회수의무/상품처리의 적합성을 사용자에게 검토하게 한다.
- 입력이 불완전하거나 합의/정책 불명 상태면 특정 방식에 '추천' 문구 표시하지 말고 `확인 필요` 결과만 반환한다.
- 민감한 상품 유형·계약 사정에 따라 추가 법률 검토가 필요할 수 있다. 시스템은 규정 준수 여부를 판정하지 않는다.

## 검증 예시
가상 사례: fullRefund=30,000; returnShipping=3,500; handling=1,000; recoveredValue=9,000; feeReversal=0.
- 회수 전액 환급: 현금 34,500 / 순경제적 비용 25,500.
- 회수 없는 전액 환급: 현금 30,000 / 순경제적 비용 30,000.
- 회수 없는 50% 부분환급: 현금 15,000 / 순경제적 비용 15,000. **조건 미확인 시 추천/최저가 표시에서 제외.**
- 회수 대안 vs 미회수 대안 경제적 차이 4,500원(회수 대안이 비용 적음), 하지만 회수 시 즉시 현금 지출은 4,500원 더 큼. 지표별 해석을 명확히 구분.
- 처리 방식의 현금 비용이 0인데 회수가치가 9,000원이라면 economic=-9,000원 표시 허용; '9,000원 수익'처럼 오인시키지 말 것.

## 안전 테스트/불변식
- 모든 입력 동일할 때 결과 항상 동일 (pure, deterministic).
- 운송비 1,000원 증가 시 해당 방식의 두 지표도 1,000원 증가.
- 회수가치 1,000원 증가 시 해당 방식 `economicCost`만 1,000원 감소하고 `cashOutflow`는 불변.
- 고객부담 운송비는 판매자 부담에 재합산하면 안 됨.
- 부분환불 불허/불명 = 추천 후보 절대 불가.
- 부정확한/불완전한 입력 = 최적 해법 노출 차단.
- 서로 다른 권리/고객 동의 상태의 선택지들을 하나의 랭킹으로 통합하면 안 됨.
