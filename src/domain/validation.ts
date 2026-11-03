/**
 * ReturnWise Domain Input Validation Engine (src/domain/validation.ts)
 * 100% Pure TypeScript. Zero dependencies on React, DOM, or Browser APIs.
 * SSOT: docs/02_FINANCIAL_DOMAIN.md, docs/03_LEGAL_SAFETY.md
 */

import { parseMoney, ParseMoneyResult } from './money';
import { ReturnInputs, DecisionFlags, ReturnReason } from './types';

export interface FieldValidationError {
  field: string;
  code: string;
  message: string;
}

export interface InputValidationResult {
  isValid: boolean;
  parsedInputs?: ReturnInputs;
  fieldErrors: Record<string, FieldValidationError>;
  globalErrors: string[];
}

/**
 * 반품 계산기 전체 입력 폼 유효성 검증
 */
export function validateReturnInputs(
  rawInputs: Record<string, string | number | null | undefined>,
  flags?: Partial<DecisionFlags>
): InputValidationResult {
  const fieldErrors: Record<string, FieldValidationError> = {};
  const globalErrors: string[] = [];
  const parsedInputs: ReturnInputs = {};

  function checkField(
    fieldName: keyof ReturnInputs,
    required: boolean,
    label: string
  ): ParseMoneyResult {
    const rawVal = rawInputs[fieldName];
    const res = parseMoney(rawVal, { required, fieldName });

    if (!res.success) {
      fieldErrors[fieldName] = {
        field: fieldName,
        code: res.error || 'INVALID',
        message: `${label}: ${res.errorMessage || '유효하지 않은 금액입니다.'}`,
      };
    } else if (res.value !== undefined) {
      parsedInputs[fieldName] = res.value;
    } else {
      // optional 필드 미입력 시 기본값 0 할당
      parsedInputs[fieldName] = 0;
    }
    return res;
  }

  // 1. 개별 금액 필드 파싱 및 유효성 검사
  const refundRes = checkField('refundAmount', true, '환급 예정 금액');
  checkField('reverseShippingSellerCost', false, '판매자 부담 회수 운임');
  checkField('reverseShippingBuyerCost', false, '구매자 부담 회수 운임');
  checkField('handlingCost', false, '검수/재포장비');
  checkField('recoveredItemNetValue', false, '회수 상품 순가치');
  checkField('feeReversalCredit', false, '확정 수수료 환급액');
  checkField('additionalSellerCost', false, '기타 추가 비용');
  checkField('agreedPartialRefund', false, '합의된 부분환급액');
  checkField('replacementCost', false, '교환 재발송 상품원가');
  checkField('replacementOutboundShipping', false, '교환 출고 운임');

  // 2. 크로스 필드 비즈니스 로직 검증
  if (refundRes.success && parsedInputs.refundAmount !== undefined) {
    // 2.1 부분환급액이 전액환불액을 초과할 수 없음
    if (
      parsedInputs.agreedPartialRefund !== undefined &&
      parsedInputs.agreedPartialRefund > parsedInputs.refundAmount
    ) {
      const msg = '합의된 부분환급액은 전액 환불 금액을 초과할 수 없습니다.';
      fieldErrors.agreedPartialRefund = {
        field: 'agreedPartialRefund',
        code: 'PARTIAL_EXCEEDS_FULL',
        message: msg,
      };
      globalErrors.push(msg);
    }
  }

  // 2.2 법률 가드레일 (L02): 판매자 귀책 시 고객에게 운임 전가 시도 차단
  if (flags?.reason) {
    const isSellerFault: boolean =
      flags.reason === ('SELLER_FAULT' as ReturnReason) ||
      flags.reason === ('DEFECT_OR_DIFF' as ReturnReason);

    if (
      isSellerFault &&
      parsedInputs.reverseShippingBuyerCost !== undefined &&
      parsedInputs.reverseShippingBuyerCost > 0
    ) {
      const msg =
        '판매자 귀책(오배송/하자)의 경우 반품 배송비는 전자상거래법 제18조 제9항에 따라 판매자가 전액 부담해야 합니다. 고객 부담 운임을 0원으로 설정해 주세요.';
      fieldErrors.reverseShippingBuyerCost = {
        field: 'reverseShippingBuyerCost',
        code: 'SELLER_FAULT_BUYER_CHARGE_FORBIDDEN',
        message: msg,
      };
      globalErrors.push(msg);
    }
  }

  const isValid = Object.keys(fieldErrors).length === 0 && globalErrors.length === 0;

  return {
    isValid,
    parsedInputs: isValid ? parsedInputs : undefined,
    fieldErrors,
    globalErrors,
  };
}
