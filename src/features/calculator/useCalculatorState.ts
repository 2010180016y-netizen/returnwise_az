/**
 * ReturnWise Calculator State Hook (src/features/calculator/useCalculatorState.ts)
 * Manages 1-page form state, instant pure calculation, error validation, and example loading.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  DecisionFlags,
  RankMetric,
  ScenarioInput,
  ComparisonResult,
} from '../../domain/types';
import { parseMoney } from '../../domain/money';
import { compareAlternatives } from '../../domain/compare';

export interface RawInputFields {
  refundAmount: string;
  reverseShippingSellerCost: string;
  reverseShippingBuyerCost: string;
  handlingCost: string;
  recoveredItemNetValue: string;
  feeReversalCredit: string;
  additionalSellerCost: string;
  agreedPartialRefund: string;
  replacementCost: string;
  replacementOutboundShipping: string;
}

const initialRawInputs: RawInputFields = {
  refundAmount: '30,000',
  reverseShippingSellerCost: '3,500',
  reverseShippingBuyerCost: '0',
  handlingCost: '1,000',
  recoveredItemNetValue: '9,000',
  feeReversalCredit: '0',
  additionalSellerCost: '0',
  agreedPartialRefund: '15,000',
  replacementCost: '12,000',
  replacementOutboundShipping: '3,000',
};

const initialFlags: DecisionFlags = {
  reason: 'BUYER_REMORSE',
  buyerRequest: 'REFUND',
  platform: 'NAVER',
  policyReviewed: false,
  rightsReviewed: false,
  voluntaryAgreementConfirmed: false,
  permittedByPolicyConfirmed: false,
  rightsNotRestrictedConfirmed: false,
  buyerAgreedExchange: false,
  isSpecialItem: false,
  isPolicyOutdated: false,
};

export function useCalculatorState() {
  const [rawInputs, setRawInputs] = useState<RawInputFields>(initialRawInputs);
  const [flags, setFlags] = useState<DecisionFlags>(initialFlags);
  const [metric, setMetric] = useState<RankMetric>('ECONOMIC_COST');

  // Parse raw inputs to domain ScenarioInput numbers
  const { parsedInputs, inputErrors } = useMemo(() => {
    const errors: Record<string, string> = {};
    const parsed: ScenarioInput = {};

    const parseField = (
      key: keyof RawInputFields,
      required: boolean = false
    ) => {
      const raw = rawInputs[key];
      const res = parseMoney(raw, { required });
      if (!res.success) {
        if (res.error === 'MISSING_REQUIRED') errors[key] = '필수 입력 항목입니다.';
        else if (res.error === 'MAX_AMOUNT_EXCEEDED') errors[key] = '10억 원을 초과할 수 없습니다.';
        else if (res.error === 'NEGATIVE_NOT_ALLOWED') errors[key] = '음수는 입력할 수 없습니다.';
        else if (res.error === 'DECIMAL_NOT_ALLOWED') errors[key] = '원 단위 정수만 입력 가능합니다.';
        else errors[key] = '올바른 금액 형식을 입력해 주세요.';
      } else {
        (parsed as Record<string, number | undefined>)[key] = res.value;
      }
    };

    parseField('refundAmount', true);
    parseField('reverseShippingSellerCost', false);
    parseField('reverseShippingBuyerCost', false);
    parseField('handlingCost', false);
    parseField('recoveredItemNetValue', false);
    parseField('feeReversalCredit', false);
    parseField('additionalSellerCost', false);
    parseField('agreedPartialRefund', false);
    parseField('replacementCost', false);
    parseField('replacementOutboundShipping', false);

    // Partial refund must not exceed full refund
    if (
      parsed.agreedPartialRefund !== undefined &&
      parsed.refundAmount !== undefined &&
      parsed.agreedPartialRefund > parsed.refundAmount
    ) {
      errors.agreedPartialRefund = '부분환불액이 전액환불액을 초과할 수 없습니다.';
    }

    return { parsedInputs: parsed, inputErrors: errors };
  }, [rawInputs]);

  // Derive instant calculation result
  const comparisonResult: ComparisonResult = useMemo(() => {
    return compareAlternatives(parsedInputs, flags, metric);
  }, [parsedInputs, flags, metric]);

  const updateRawInput = useCallback((key: keyof RawInputFields, value: string) => {
    setRawInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateFlag = useCallback(
    <K extends keyof DecisionFlags>(key: K, value: DecisionFlags[K]) => {
      setFlags((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const loadExampleC01 = useCallback(() => {
    setRawInputs({
      refundAmount: '30,000',
      reverseShippingSellerCost: '3,500',
      reverseShippingBuyerCost: '0',
      handlingCost: '1,000',
      recoveredItemNetValue: '9,000',
      feeReversalCredit: '0',
      additionalSellerCost: '0',
      agreedPartialRefund: '15,000',
      replacementCost: '12,000',
      replacementOutboundShipping: '3,000',
    });
    setFlags({
      reason: 'BUYER_REMORSE',
      buyerRequest: 'REFUND',
      platform: 'NAVER',
      policyReviewed: true,
      rightsReviewed: true,
      voluntaryAgreementConfirmed: false,
      permittedByPolicyConfirmed: true,
      rightsNotRestrictedConfirmed: true,
      buyerAgreedExchange: false,
      isSpecialItem: false,
      isPolicyOutdated: false,
    });
  }, []);

  const loadExampleC03 = useCallback(() => {
    setRawInputs({
      refundAmount: '30,000',
      reverseShippingSellerCost: '3,500',
      reverseShippingBuyerCost: '0',
      handlingCost: '1,000',
      recoveredItemNetValue: '9,000',
      feeReversalCredit: '0',
      additionalSellerCost: '0',
      agreedPartialRefund: '15,000',
      replacementCost: '12,000',
      replacementOutboundShipping: '3,000',
    });
    setFlags({
      reason: 'BUYER_REMORSE',
      buyerRequest: 'REFUND',
      platform: 'NAVER',
      policyReviewed: true,
      rightsReviewed: true,
      voluntaryAgreementConfirmed: true,
      permittedByPolicyConfirmed: true,
      rightsNotRestrictedConfirmed: true,
      buyerAgreedExchange: false,
      isSpecialItem: false,
      isPolicyOutdated: false,
    });
  }, []);

  const resetAll = useCallback(() => {
    setRawInputs({
      refundAmount: '',
      reverseShippingSellerCost: '',
      reverseShippingBuyerCost: '',
      handlingCost: '',
      recoveredItemNetValue: '',
      feeReversalCredit: '',
      additionalSellerCost: '',
      agreedPartialRefund: '',
      replacementCost: '',
      replacementOutboundShipping: '',
    });
    setFlags({
      reason: 'UNKNOWN_REASON',
      buyerRequest: 'UNKNOWN',
      platform: 'NAVER',
      policyReviewed: false,
      rightsReviewed: false,
      voluntaryAgreementConfirmed: false,
      permittedByPolicyConfirmed: false,
      rightsNotRestrictedConfirmed: false,
      buyerAgreedExchange: false,
      isSpecialItem: false,
      isPolicyOutdated: false,
    });
  }, []);

  return {
    rawInputs,
    flags,
    metric,
    inputErrors,
    parsedInputs,
    comparisonResult,
    setMetric,
    updateRawInput,
    updateFlag,
    loadExampleC01,
    loadExampleC03,
    resetAll,
  };
}
