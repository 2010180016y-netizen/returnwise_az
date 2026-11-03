/**
 * ReturnWise Pure Return & Exchange Cost Engine (src/domain/calculate.ts)
 * 100% Pure TypeScript. Zero dependencies on React, DOM, or Browser APIs.
 *
 * SSOT Reference:
 * - docs/CALCULATION_CONTRACT.md (Section 3 & 4)
 * - docs/02_FINANCIAL_DOMAIN.md (Section 3 & 4)
 */

import {
  ScenarioInput,
  AlternativeCode,
  AlternativeCostBreakdown,
  CostLineItem,
  ScenarioResult,
} from './types';

/**
 * 대안 1: 회수 후 전액환급 (RETURN_FULL)
 * 공식 출처: docs/CALCULATION_CONTRACT.md #4 대안 1
 *
 * cashOutflow = refundAmount + reverseShippingSellerCost + handlingCost + additionalSellerCost - feeReversalCredit
 * economicCost = cashOutflow - recoveredItemNetValue
 */
export function calculateReturnFull(input: ScenarioInput): AlternativeCostBreakdown {
  const refundAmount = input.refundAmount ?? 0;
  const reverseShippingSellerCost = input.reverseShippingSellerCost ?? 0;
  const handlingCost = input.handlingCost ?? 0;
  const additionalSellerCost = input.additionalSellerCost ?? 0;
  const feeReversalCredit = input.feeReversalCredit ?? 0;
  const recoveredItemNetValue = input.recoveredItemNetValue ?? 0;

  const lineItems: CostLineItem[] = [];

  if (refundAmount > 0) {
    lineItems.push({
      id: 'refund_amount',
      name: '구매자 환급액',
      amount: refundAmount,
      type: 'CASH_OUTFLOW',
      description: '구매자에게 반환하는 상품 결제 대금',
    });
  }

  if (reverseShippingSellerCost > 0) {
    lineItems.push({
      id: 'reverse_shipping_seller',
      name: '판매자 부담 회수 운임',
      amount: reverseShippingSellerCost,
      type: 'CASH_OUTFLOW',
      description: '반품 택배사에 직접 지불하는 회수 비용',
    });
  }

  if (handlingCost > 0) {
    lineItems.push({
      id: 'handling_cost',
      name: '검수/재포장비',
      amount: handlingCost,
      type: 'CASH_OUTFLOW',
      description: '입고 검수, 소독, 재포장 자재비',
    });
  }

  if (additionalSellerCost > 0) {
    lineItems.push({
      id: 'additional_seller_cost',
      name: '기타 추가 비용',
      amount: additionalSellerCost,
      type: 'CASH_OUTFLOW',
      description: '반품 처리 시 부가 발생하는 실비',
    });
  }

  if (feeReversalCredit > 0) {
    lineItems.push({
      id: 'fee_reversal_credit',
      name: '확정 수수료 환급액',
      amount: feeReversalCredit,
      type: 'CREDIT',
      description: '마켓/PG사로부터 환급 확정된 판매 수수료',
    });
  }

  if (recoveredItemNetValue > 0) {
    lineItems.push({
      id: 'recovered_item_net_value',
      name: '회수 상품 순가치',
      amount: recoveredItemNetValue,
      type: 'ASSET_VALUE',
      description: '회수된 상품의 재판매·처분 가능 순가치 (비현금 자산)',
    });
  }

  const cashOutflow =
    refundAmount +
    reverseShippingSellerCost +
    handlingCost +
    additionalSellerCost -
    feeReversalCredit;

  const economicCost = cashOutflow - recoveredItemNetValue;

  return {
    alternative: 'RETURN_FULL',
    name: '회수 후 전액환급',
    cashOutflow,
    economicCost,
    lineItems,
  };
}

/**
 * 대안 2: 회수 없는 전액환급 (KEEP_FULL)
 * 공식 출처: docs/CALCULATION_CONTRACT.md #4 대안 2
 *
 * cashOutflow = refundAmount + additionalSellerCost - feeReversalCredit
 * economicCost = cashOutflow (회수 상품가치 = 0)
 */
export function calculateKeepFull(input: ScenarioInput): AlternativeCostBreakdown {
  const refundAmount = input.refundAmount ?? 0;
  const additionalSellerCost = input.additionalSellerCost ?? 0;
  const feeReversalCredit = input.feeReversalCredit ?? 0;

  const lineItems: CostLineItem[] = [];

  if (refundAmount > 0) {
    lineItems.push({
      id: 'refund_amount',
      name: '구매자 환급액',
      amount: refundAmount,
      type: 'CASH_OUTFLOW',
      description: '회수 없이 전액 반환하는 상품 결제 대금',
    });
  }

  if (additionalSellerCost > 0) {
    lineItems.push({
      id: 'additional_seller_cost',
      name: '기타 추가 비용',
      amount: additionalSellerCost,
      type: 'CASH_OUTFLOW',
      description: '회수 포기 처리 관련 추가 비용',
    });
  }

  if (feeReversalCredit > 0) {
    lineItems.push({
      id: 'fee_reversal_credit',
      name: '확정 수수료 환급액',
      amount: feeReversalCredit,
      type: 'CREDIT',
      description: '마켓/PG사로부터 환급 확정된 판매 수수료',
    });
  }

  const cashOutflow = refundAmount + additionalSellerCost - feeReversalCredit;
  const economicCost = cashOutflow;

  return {
    alternative: 'KEEP_FULL',
    name: '회수 없는 전액환급',
    cashOutflow,
    economicCost,
    lineItems,
  };
}

/**
 * 대안 3: 합의된 부분환급 (KEEP_PARTIAL)
 * 공식 출처: docs/CALCULATION_CONTRACT.md #4 대안 3
 *
 * cashOutflow = agreedPartialRefund + additionalSellerCost - feeReversalCredit
 * economicCost = cashOutflow (고객 보유, 회수 상품가치 = 0)
 */
export function calculateKeepPartial(input: ScenarioInput): AlternativeCostBreakdown {
  const agreedPartialRefund = input.agreedPartialRefund ?? 0;
  const additionalSellerCost = input.additionalSellerCost ?? 0;
  const feeReversalCredit = input.feeReversalCredit ?? 0;

  const lineItems: CostLineItem[] = [];

  if (agreedPartialRefund > 0) {
    lineItems.push({
      id: 'agreed_partial_refund',
      name: '합의된 부분환급액',
      amount: agreedPartialRefund,
      type: 'CASH_OUTFLOW',
      description: '고객과 사전 자발적 합의된 보상/환급 금액',
    });
  }

  if (additionalSellerCost > 0) {
    lineItems.push({
      id: 'additional_seller_cost',
      name: '기타 추가 비용',
      amount: additionalSellerCost,
      type: 'CASH_OUTFLOW',
      description: '부분 환급 처리 부가 비용',
    });
  }

  if (feeReversalCredit > 0) {
    lineItems.push({
      id: 'fee_reversal_credit',
      name: '확정 수수료 환급액',
      amount: feeReversalCredit,
      type: 'CREDIT',
      description: '부분 취소 시 마켓에서 확정 환급되는 수수료',
    });
  }

  const cashOutflow = agreedPartialRefund + additionalSellerCost - feeReversalCredit;
  const economicCost = cashOutflow;

  return {
    alternative: 'KEEP_PARTIAL',
    name: '합의된 부분환급',
    cashOutflow,
    economicCost,
    lineItems,
  };
}

/**
 * 대안 4: 1:1 맞교환 처리 (EXCHANGE)
 * 공식 출처: docs/CALCULATION_CONTRACT.md #4 대안 4
 *
 * cashOutflow = replacementCost + reverseShippingSellerCost + replacementOutboundShipping + handlingCost + additionalSellerCost - feeReversalCredit
 * economicCost = cashOutflow - recoveredItemNetValue
 */
export function calculateExchange(input: ScenarioInput): AlternativeCostBreakdown {
  const replacementCost = input.replacementCost ?? 0;
  const reverseShippingSellerCost = input.reverseShippingSellerCost ?? 0;
  const replacementOutboundShipping = input.replacementOutboundShipping ?? 0;
  const handlingCost = input.handlingCost ?? 0;
  const additionalSellerCost = input.additionalSellerCost ?? 0;
  const feeReversalCredit = input.feeReversalCredit ?? 0;
  const recoveredItemNetValue = input.recoveredItemNetValue ?? 0;

  const lineItems: CostLineItem[] = [];

  if (replacementCost > 0) {
    lineItems.push({
      id: 'replacement_cost',
      name: '교환 재발송 상품원가',
      amount: replacementCost,
      type: 'CASH_OUTFLOW',
      description: '새 상품 재출고를 위한 조달/매입 원가',
    });
  }

  if (reverseShippingSellerCost > 0) {
    lineItems.push({
      id: 'reverse_shipping_seller',
      name: '판매자 부담 회수 운임',
      amount: reverseShippingSellerCost,
      type: 'CASH_OUTFLOW',
      description: '기존 불량/반품 상품 회수 운임',
    });
  }

  if (replacementOutboundShipping > 0) {
    lineItems.push({
      id: 'replacement_outbound_shipping',
      name: '교환 출고 운임',
      amount: replacementOutboundShipping,
      type: 'CASH_OUTFLOW',
      description: '새 교환 상품 고객 발송 편도 운임',
    });
  }

  if (handlingCost > 0) {
    lineItems.push({
      id: 'handling_cost',
      name: '검수/재포장비',
      amount: handlingCost,
      type: 'CASH_OUTFLOW',
      description: '교환품 검수 및 포장 작업비',
    });
  }

  if (additionalSellerCost > 0) {
    lineItems.push({
      id: 'additional_seller_cost',
      name: '기타 추가 비용',
      amount: additionalSellerCost,
      type: 'CASH_OUTFLOW',
      description: '교환 처리 부가 비용',
    });
  }

  if (feeReversalCredit > 0) {
    lineItems.push({
      id: 'fee_reversal_credit',
      name: '확정 수수료 환급액',
      amount: feeReversalCredit,
      type: 'CREDIT',
      description: '교환 관련 수수료 차감분',
    });
  }

  if (recoveredItemNetValue > 0) {
    lineItems.push({
      id: 'recovered_item_net_value',
      name: '회수 상품 순가치',
      amount: recoveredItemNetValue,
      type: 'ASSET_VALUE',
      description: '회수된 기존 상품의 재판매·활용 가능 순가치',
    });
  }

  const cashOutflow =
    replacementCost +
    reverseShippingSellerCost +
    replacementOutboundShipping +
    handlingCost +
    additionalSellerCost -
    feeReversalCredit;

  const economicCost = cashOutflow - recoveredItemNetValue;

  return {
    alternative: 'EXCHANGE',
    name: '1:1 맞교환 처리',
    cashOutflow,
    economicCost,
    lineItems,
  };
}

/**
 * 원장 항목(lineItems) 합과 계산 결과(cashOutflow, economicCost)의 일치성 검증 헬퍼
 */
export function verifyLineItemsIntegrity(breakdown: AlternativeCostBreakdown): boolean {
  let outflowSum = 0;
  let creditSum = 0;
  let assetSum = 0;

  for (const item of breakdown.lineItems) {
    if (item.type === 'CASH_OUTFLOW') {
      outflowSum += item.amount;
    } else if (item.type === 'CREDIT') {
      creditSum += item.amount;
    } else if (item.type === 'ASSET_VALUE') {
      assetSum += item.amount;
    }
  }

  const calculatedCashOutflow = outflowSum - creditSum;
  const calculatedEconomicCost = calculatedCashOutflow - assetSum;

  return (
    calculatedCashOutflow === breakdown.cashOutflow &&
    calculatedEconomicCost === breakdown.economicCost
  );
}

/**
 * 4대 대안 통합 순수 계산 엔진
 *
 * 불변식:
 * 1. 입력 객체는 절대 변형(mutation)하지 않는다.
 * 2. deterministic한 안정 정렬(Stable Sort):
 *    - 1순위: economicCost 오름차순
 *    - 2순위: cashOutflow 오름차순
 *    - 3순위: alternative 코드 알파벳 오름차순
 */
export function calculateAllAlternatives(input: Readonly<ScenarioInput>): ScenarioResult {
  // 입력 객체 방어적 복사 (Immutable)
  const safeInput: ScenarioInput = { ...input };

  const returnFull = calculateReturnFull(safeInput);
  const keepFull = calculateKeepFull(safeInput);
  const keepPartial = calculateKeepPartial(safeInput);
  const exchange = calculateExchange(safeInput);

  const results: Record<AlternativeCode, AlternativeCostBreakdown> = {
    RETURN_FULL: returnFull,
    KEEP_FULL: keepFull,
    KEEP_PARTIAL: keepPartial,
    EXCHANGE: exchange,
  };

  // 안정 정렬 (Deterministic)
  const sortedAlternatives = [returnFull, keepFull, keepPartial, exchange].sort((a, b) => {
    if (a.economicCost !== b.economicCost) {
      return a.economicCost - b.economicCost;
    }
    if (a.cashOutflow !== b.cashOutflow) {
      return a.cashOutflow - b.cashOutflow;
    }
    return a.alternative.localeCompare(b.alternative);
  });

  return {
    inputs: safeInput,
    results,
    sortedAlternatives,
  };
}
