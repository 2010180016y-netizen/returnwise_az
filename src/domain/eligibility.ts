/**
 * ReturnWise Option Eligibility & Policy Gate Engine (src/domain/eligibility.ts)
 * 100% Pure TypeScript. Zero dependencies on React, DOM, or Browser APIs.
 *
 * SSOT Reference:
 * - docs/DECISION_GATE_MATRIX.md (Fail-closed Gate Architecture & L01~L08)
 * - docs/03_LEGAL_SAFETY.md (Legal Safety & Regulatory Checklist)
 */

import {
  AlternativeCode,
  DecisionFlags,
  OptionEligibility,
  PolicyEvaluationResult,
  ReturnInputs,
} from './types';

/**
 * 대안 1: 회수 후 전액환급 (RETURN_FULL) 자격 심사
 * 관련 게이트: L01 (귀책 확인), L02 (운임 전가 방지)
 */
export function evaluateReturnFullEligibility(
  flags: DecisionFlags,
  inputs?: ReturnInputs
): OptionEligibility {
  const reasons: string[] = [];

  // L01: 귀책 사유 미확인 차단
  if (!flags.reason || flags.reason === 'UNKNOWN_REASON') {
    reasons.push('반품 귀책 사유가 확인되지 않아 정당한 운임 부담 주체 검토가 필요합니다 (L01).');
    return {
      alternative: 'RETURN_FULL',
      name: '회수 후 전액환급',
      status: 'REQUIRES_REVIEW',
      rankingEligible: false,
      reasons,
    };
  }

  // L02: 판매자 귀책 시 반품비 고객 전가 차단 (전자상거래법 제18조 제9항)
  const isSellerFault = flags.reason === 'SELLER_FAULT' || flags.reason === 'DEFECT_OR_DIFF';
  if (isSellerFault && inputs?.reverseShippingBuyerCost && inputs.reverseShippingBuyerCost > 0) {
    reasons.push(
      '판매자 귀책 사유 시 반품 배송비를 구매자에게 부담시키는 것은 전자상거래법 제18조 제9항 위반입니다 (L02).'
    );
    return {
      alternative: 'RETURN_FULL',
      name: '회수 후 전액환급',
      status: 'INELIGIBLE',
      rankingEligible: false,
      reasons,
    };
  }

  const legalNotice = isSellerFault
    ? '판매자 귀책 사유로 반품 배송비 전액을 판매자가 부담합니다 (전자상거래법 제18조 제9항).'
    : '소비자 단순변심에 의한 반품으로 반품 배송비는 소비자가 부담합니다 (전자상거래법 제18조 제9항).';

  return {
    alternative: 'RETURN_FULL',
    name: '회수 후 전액환급',
    status: 'ELIGIBLE',
    rankingEligible: true,
    reasons: [],
    legalNotice,
  };
}

/**
 * 대안 2: 회수 없는 전액환급 (KEEP_FULL) 자격 심사
 * 관련 게이트: L01 (귀책 확인), L07 (특례 품목), L08 (안전 모드)
 */
export function evaluateKeepFullEligibility(flags: DecisionFlags): OptionEligibility {
  const reasons: string[] = [];

  // L01: 귀책 사유 미확인 차단
  if (!flags.reason || flags.reason === 'UNKNOWN_REASON') {
    reasons.push('반품 귀책 사유가 확인되지 않았습니다 (L01).');
    return {
      alternative: 'KEEP_FULL',
      name: '회수 없는 전액환급',
      status: 'REQUIRES_REVIEW',
      rankingEligible: false,
      reasons,
    };
  }

  // L07: 특례 품목 확인 필요
  if (flags.isSpecialItem) {
    reasons.push('특례 품목의 경우 마켓 반품 프로세스상 회수 생략 승인 요건 확인이 필요합니다 (L07).');
    return {
      alternative: 'KEEP_FULL',
      name: '회수 없는 전액환급',
      status: 'REQUIRES_REVIEW',
      rankingEligible: false,
      reasons,
    };
  }

  // L08: 정책 재검증 안전 모드
  if (flags.isPolicyOutdated) {
    reasons.push('정책 재검증 안전 모드 작동 중으로 마켓 회수 규정 확인이 필요합니다 (L08).');
    return {
      alternative: 'KEEP_FULL',
      name: '회수 없는 전액환급',
      status: 'REQUIRES_REVIEW',
      rankingEligible: false,
      reasons,
    };
  }

  return {
    alternative: 'KEEP_FULL',
    name: '회수 없는 전액환급',
    status: 'ELIGIBLE',
    rankingEligible: true,
    reasons: [],
    legalNotice: '판매자의 자발적 회수 포기에 의한 전액 환급 대안입니다.',
  };
}

/**
 * 대안 3: 합의된 부분환급 (KEEP_PARTIAL) 자격 심사
 * 관련 게이트: L01, L03 (자발적 합의), L04 (마켓 약관), L05 (권리 비침해), L08 (안전 모드)
 * 3요건 미충족 시 추천 목록에서 원천 차단 (Fail-closed)
 */
export function evaluateKeepPartialEligibility(flags: DecisionFlags): OptionEligibility {
  const reasons: string[] = [];

  // L01: 귀책 사유 미확인 차단
  if (!flags.reason || flags.reason === 'UNKNOWN_REASON') {
    reasons.push('귀책 사유 미확인 상태에서는 부분환급을 제안할 수 없습니다 (L01).');
    return {
      alternative: 'KEEP_PARTIAL',
      name: '합의된 부분환급',
      status: 'INELIGIBLE',
      rankingEligible: false,
      reasons,
    };
  }

  // L08: 정책 안전 모드에서는 부분환급 차단
  if (flags.isPolicyOutdated) {
    reasons.push('정책 재검증 안전 모드에서는 부분환급 추천이 자동 비활성화됩니다 (L08).');
    return {
      alternative: 'KEEP_PARTIAL',
      name: '합의된 부분환급',
      status: 'INELIGIBLE',
      rankingEligible: false,
      reasons,
    };
  }

  // L03, L04, L05: 3대 핵심 요건 검증
  if (!flags.voluntaryAgreementConfirmed) {
    reasons.push(
      '소비자의 자발적 합의가 확인되지 않았습니다. 일방적 부분환급 강요는 법정 청약철회 방해 행위입니다 (L03).'
    );
  }

  if (!flags.permittedByPolicyConfirmed) {
    reasons.push(
      '해당 판매 마켓의 약관 및 시스템상 부분환급 허용 여부가 확인되지 않았습니다 (L04).'
    );
  }

  if (!flags.rightsNotRestrictedConfirmed) {
    reasons.push(
      '소비자의 법정 청약철회 권리가 제한되거나 침해되지 않음이 확인되지 않았습니다 (L05).'
    );
  }

  if (reasons.length > 0) {
    return {
      alternative: 'KEEP_PARTIAL',
      name: '합의된 부분환급',
      status: 'INELIGIBLE',
      rankingEligible: false,
      reasons,
    };
  }

  return {
    alternative: 'KEEP_PARTIAL',
    name: '합의된 부분환급',
    status: 'ELIGIBLE',
    rankingEligible: true,
    reasons: [],
    legalNotice:
      '소비자 자발적 합의, 마켓 약관 허용, 법정 권리 비침해 3대 요건이 모두 확인된 적격 대안입니다.',
  };
}

/**
 * 대안 4: 1:1 맞교환 처리 (EXCHANGE) 자격 심사
 * 관련 게이트: L01, L06 (교환 강요 차단)
 */
export function evaluateExchangeEligibility(flags: DecisionFlags): OptionEligibility {
  const reasons: string[] = [];

  // L01: 귀책 사유 미확인 차단
  if (!flags.reason || flags.reason === 'UNKNOWN_REASON') {
    reasons.push('귀책 사유 미확인 상태에서는 교환 추천이 차단됩니다 (L01).');
    return {
      alternative: 'EXCHANGE',
      name: '1:1 맞교환 처리',
      status: 'INELIGIBLE',
      rankingEligible: false,
      reasons,
    };
  }

  // L06: 고객이 환불 요청 시 교환 강요 차단 (전자상거래법 제17조 위반 방지)
  if (flags.buyerRequest === 'REFUND' && !flags.buyerAgreedExchange) {
    reasons.push(
      '구매자가 환불을 요청한 경우 구매자의 사전 명시적 동의 없이 교환을 유도하거나 강제할 수 없습니다 (L06).'
    );
    return {
      alternative: 'EXCHANGE',
      name: '1:1 맞교환 처리',
      status: 'INELIGIBLE',
      rankingEligible: false,
      reasons,
    };
  }

  if (flags.buyerRequest === 'EXCHANGE' || flags.buyerAgreedExchange) {
    return {
      alternative: 'EXCHANGE',
      name: '1:1 맞교환 처리',
      status: 'ELIGIBLE',
      rankingEligible: true,
      reasons: [],
      legalNotice: '구매자의 교환 요청 또는 사전 합의가 확인된 적격 대안입니다.',
    };
  }

  // buyerRequest === 'UNKNOWN'
  reasons.push('구매자의 교환 의사가 확인되지 않아 검토가 필요합니다.');
  return {
    alternative: 'EXCHANGE',
    name: '1:1 맞교환 처리',
    status: 'REQUIRES_REVIEW',
    rankingEligible: false,
    reasons,
  };
}

/**
 * 전체 4대 대안 정책 자격 종합 심사 함수
 */
export function evaluateAllEligibility(
  flags: DecisionFlags,
  inputs?: ReturnInputs
): PolicyEvaluationResult {
  const returnFull = evaluateReturnFullEligibility(flags, inputs);
  const keepFull = evaluateKeepFullEligibility(flags);
  const keepPartial = evaluateKeepPartialEligibility(flags);
  const exchange = evaluateExchangeEligibility(flags);

  const evaluations: Record<AlternativeCode, OptionEligibility> = {
    RETURN_FULL: returnFull,
    KEEP_FULL: keepFull,
    KEEP_PARTIAL: keepPartial,
    EXCHANGE: exchange,
  };

  // Fail closed: an unreviewed policy, unreviewed statutory rights, or an
  // unknown marketplace must never produce an actionable cost recommendation.
  // Keep already-blocked alternatives unchanged to preserve their stronger reasons.
  const reviewBlocks: string[] = [];
  if (!flags.policyReviewed) {
    reviewBlocks.push('해당 마켓의 최신 환불·회수 정책 확인이 필요합니다.');
  }
  if (!flags.rightsReviewed) {
    reviewBlocks.push('구매자의 법정 청약철회·환급 권리 확인이 필요합니다.');
  }
  if (flags.platform === 'OTHER') {
    reviewBlocks.push('미확인 플랫폼의 정책 확인 전에는 추천할 수 없습니다.');
  }

  if (reviewBlocks.length > 0) {
    for (const evaluation of Object.values(evaluations)) {
      if (evaluation.status === 'ELIGIBLE') {
        evaluation.status = 'REQUIRES_REVIEW';
        evaluation.rankingEligible = false;
        evaluation.reasons.push(...reviewBlocks);
        evaluation.legalNotice = undefined;
      }
    }
  }

  const globalWarnings: string[] = [];
  globalWarnings.push(...reviewBlocks);

  // L07: 특례 품목 글로벌 경고 안내
  const hasSpecialItemWarning = Boolean(flags.isSpecialItem);
  if (hasSpecialItemWarning) {
    globalWarnings.push(
      '식품, 위생용품, 주문제작 상품 등 특례 품목은 전자상거래법 제17조 제2항에 따라 청약철회가 제한될 수 있으므로 전문 법률 및 마켓 분쟁조정 기준 검토가 필요합니다 (L07).'
    );
  }

  // L08: 정책 안전 모드 글로벌 경고 안내
  const isSafeModeActive = Boolean(flags.isPolicyOutdated);
  if (isSafeModeActive) {
    globalWarnings.push(
      '플랫폼 정책 변경 또는 검증 주기 도래로 안전 모드가 활성화되었습니다. 기본 환급 계산기 외 특수 대안은 추천에서 제외됩니다 (L08).'
    );
  }

  // L01: 사유 불명 시 전체 추천 중지 안내
  if (!flags.reason || flags.reason === 'UNKNOWN_REASON') {
    globalWarnings.push('귀책 사유가 불분명하여 모든 대안의 최저비용 추천이 차단되었습니다 (L01).');
  }

  // 외부 플랫폼 경고
  if (flags.platform === 'OTHER') {
    globalWarnings.push('미확인 외부 플랫폼입니다. 해당 마켓의 판매자 정책을 수동으로 확인해 주세요.');
  }

  // 적격(ELIGIBLE) 대안만 추출
  const eligibleAlternatives: AlternativeCode[] = [];
  if (flags.reason !== 'UNKNOWN_REASON') {
    for (const [code, evaluation] of Object.entries(evaluations)) {
      if (evaluation.status === 'ELIGIBLE' && evaluation.rankingEligible) {
        eligibleAlternatives.push(code as AlternativeCode);
      }
    }
  }

  return {
    flags,
    evaluations,
    eligibleAlternatives,
    hasSpecialItemWarning,
    isSafeModeActive,
    globalWarnings,
  };
}
