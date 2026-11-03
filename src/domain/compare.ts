/**
 * ReturnWise Alternative Comparison & Ranking Engine (src/domain/compare.ts)
 * 100% Pure TypeScript. Zero dependencies on React, DOM, or Browser APIs.
 *
 * SSOT Reference:
 * - docs/01_PRODUCT_PRD.md & docs/PRODUCT_SCOPE_LOCK.md (REQ-P0-03, REQ-P0-04, REQ-P0-05)
 * - docs/DECISION_GATE_MATRIX.md (Fail-closed Gate Matrix)
 * - docs/CALCULATION_CONTRACT.md (Cost Formulas & Invariants)
 */

import { calculateAllAlternatives } from './calculate';
import { evaluateAllEligibility } from './eligibility';
import {
  AlternativeCode,
  AlternativeCategory,
  ConfidenceLevel,
  DecisionFlags,
  RankMetric,
  RankedAlternative,
  ComparisonResult,
  ScenarioInput,
} from './types';

/**
 * 대안별 카테고리 분리 (환불군 vs 교환군)
 */
export function getAlternativeCategory(alt: AlternativeCode): AlternativeCategory {
  return alt === 'EXCHANGE' ? 'EXCHANGE_GROUP' : 'REFUND_GROUP';
}

/**
 * 대안별 주요 가정 및 누락 가능 비용 안내 문구 생성
 */
export function generateAssumptions(alt: AlternativeCode, inputs: ScenarioInput): string[] {
  const assumptions: string[] = [];
  const recoveredValue = inputs.recoveredItemNetValue ?? 0;
  const handlingCost = inputs.handlingCost ?? 0;
  const replacementCost = inputs.replacementCost ?? 0;
  const outboundShipping = inputs.replacementOutboundShipping ?? 0;

  switch (alt) {
    case 'RETURN_FULL':
      assumptions.push(
        recoveredValue > 0
          ? `회수 상품 순가치 ${recoveredValue.toLocaleString('ko-KR')}원의 실제 재판매/처분을 전제합니다.`
          : '회수 상품의 순가치가 0원(폐기 또는 재판매 불가)으로 산정되었습니다.'
      );
      if (handlingCost > 0) {
        assumptions.push(`검수 및 재포장 비용 ${handlingCost.toLocaleString('ko-KR')}원이 반영되었습니다.`);
      }
      break;

    case 'KEEP_FULL':
      assumptions.push('고객에게 상품을 전액 증정하거나 폐기하며, 회수 운임 및 검수비가 일체 발생하지 않습니다.');
      assumptions.push('회수 상품 순가치는 0원으로 처리됩니다.');
      break;

    case 'KEEP_PARTIAL':
      assumptions.push('고객이 합의된 잔여 금액 및 상품 보유를 자발적으로 수용함을 전제합니다.');
      assumptions.push('회수 운임 및 재포장비가 일체 발생하지 않습니다.');
      break;

    case 'EXCHANGE':
      assumptions.push(
        `새 상품 재발송 원가(${replacementCost.toLocaleString('ko-KR')}원)와 재출고 운임(${outboundShipping.toLocaleString('ko-KR')}원)이 추가 발생합니다.`
      );
      assumptions.push(
        recoveredValue > 0
          ? `기존 회수 상품의 잔존 순가치 ${recoveredValue.toLocaleString('ko-KR')}원이 경제비용에서 차감됩니다.`
          : '기존 상품의 회수가치는 0원으로 산정되었습니다.'
      );
      break;
  }

  return assumptions;
}

/**
 * 대안별 데이터 신뢰도(Confidence Level) 산정
 */
export function determineConfidence(
  alt: AlternativeCode,
  inputs: ScenarioInput,
  flags: DecisionFlags
): ConfidenceLevel {
  // 법률 및 권리 검토가 미완료되었거나 귀책 사유가 불명인 경우 신뢰도 LOW
  if (!flags.policyReviewed || !flags.rightsReviewed || flags.reason === 'UNKNOWN_REASON') {
    return 'LOW';
  }

  // 특례 품목이거나 정책 안전모드 상태인 경우 MEDIUM
  if (flags.isSpecialItem || flags.isPolicyOutdated) {
    return 'MEDIUM';
  }

  // 부분환불의 경우 3요건 확인 여부 체크
  if (alt === 'KEEP_PARTIAL') {
    return flags.voluntaryAgreementConfirmed &&
      flags.permittedByPolicyConfirmed &&
      flags.rightsNotRestrictedConfirmed
      ? 'HIGH'
      : 'LOW';
  }

  // 교환의 경우 고객 요청/합의 확인 체크
  if (alt === 'EXCHANGE') {
    return flags.buyerRequest === 'EXCHANGE' || flags.buyerAgreedExchange ? 'HIGH' : 'LOW';
  }

  // 회수 가치 추정 불확실성 체크
  if (alt === 'RETURN_FULL' && (inputs.recoveredItemNetValue ?? 0) === 0) {
    return 'HIGH'; // 보수적 0원 가정은 안정적
  }

  return 'HIGH';
}

/**
 * 대안 비교 및 순위 산출 순수 도메인 함수
 *
 * 불변식:
 * 1. 현금지출(cashOutflow)과 순경제비용(economicCost) 지표를 절대 혼용하지 않는다.
 * 2. 미확인/부적격(status !== 'ELIGIBLE') 대안은 절대 rank나 최저비용 추천(isRecommended)을 받지 못한다.
 * 3. 자격 충족 대안이 2개 이상일 때만 1위 추천 배지 및 차액(delta)을 표시한다.
 * 4. 동일 비용 시 결정론적 동점(Tie) 처리 및 보조 지표 대조.
 */
export function compareAlternatives(
  inputs: ScenarioInput,
  flags: DecisionFlags,
  metric: RankMetric = 'ECONOMIC_COST'
): ComparisonResult {
  // 1. 순수 비용 계산 및 정책 게이트 평가 (완전 분리 실행)
  const calculation = calculateAllAlternatives(inputs);
  const eligibility = evaluateAllEligibility(flags, inputs);

  // 2. 4대 대안 원시 데이터 합성
  const allAlternatives: RankedAlternative[] = [];
  const alternativesList: AlternativeCode[] = ['RETURN_FULL', 'KEEP_FULL', 'KEEP_PARTIAL', 'EXCHANGE'];

  for (const alt of alternativesList) {
    const costBreakdown = calculation.results[alt];
    const optionEligibility = eligibility.evaluations[alt];
    const category = getAlternativeCategory(alt);
    const comparedMetricValue =
      metric === 'ECONOMIC_COST' ? costBreakdown.economicCost : costBreakdown.cashOutflow;

    allAlternatives.push({
      alternative: alt,
      name: costBreakdown.name,
      category,
      status: optionEligibility.status,
      rankingEligible: optionEligibility.rankingEligible,
      rank: null, // 초기화 후 적격 대안에만 부여
      isRecommended: false,
      isTie: false,
      cashOutflow: costBreakdown.cashOutflow,
      economicCost: costBreakdown.economicCost,
      comparedMetricValue,
      deltaVsBest: null,
      savingsIfChosen: null,
      lineItems: costBreakdown.lineItems,
      assumptions: generateAssumptions(alt, inputs),
      confidence: determineConfidence(alt, inputs, flags),
      reasons: optionEligibility.reasons,
      legalNotice: optionEligibility.legalNotice,
    });
  }

  // 3. 자격 충족(ELIGIBLE) 대안과 미확인/비적격 대안 분리
  const eligibleAlternatives = allAlternatives.filter(
    (a) => a.rankingEligible && a.status === 'ELIGIBLE'
  );
  const ineligibleAlternatives = allAlternatives.filter(
    (a) => !a.rankingEligible || a.status !== 'ELIGIBLE'
  );

  const eligibleCount = eligibleAlternatives.length;
  const hasMultipleEligible = eligibleCount >= 2;

  // 4. 적격 대안 안정 정렬 (Deterministic Sort)
  eligibleAlternatives.sort((a, b) => {
    // 1차 기준: 선택된 metric (ECONOMIC_COST 또는 CASH_OUTFLOW)
    if (a.comparedMetricValue !== b.comparedMetricValue) {
      return a.comparedMetricValue - b.comparedMetricValue;
    }
    // 2차 기준: 보조 지표 (반대 metric)
    const aSecondary = metric === 'ECONOMIC_COST' ? a.cashOutflow : a.economicCost;
    const bSecondary = metric === 'ECONOMIC_COST' ? b.cashOutflow : b.economicCost;
    if (aSecondary !== bSecondary) {
      return aSecondary - bSecondary;
    }
    // 3차 기준: 대안 코드 알파벳 순
    return a.alternative.localeCompare(b.alternative);
  });

  // 5. 순위(Rank), 동점(Tie), 차액(Delta) 계산
  let bestAlternative: RankedAlternative | undefined = undefined;

  if (eligibleCount > 0) {
    bestAlternative = eligibleAlternatives[0];
    const bestValue = bestAlternative.comparedMetricValue;

    // 기준 대안(RETURN_FULL)의 값 (적격한 경우에만 절감액 기준점으로 활용)
    const baselineAlt = eligibleAlternatives.find((a) => a.alternative === 'RETURN_FULL');
    const baselineValue = baselineAlt ? baselineAlt.comparedMetricValue : null;

    eligibleAlternatives.forEach((alt, index) => {
      alt.rank = index + 1;

      // 동점 검사
      const isTieWithPrev =
        index > 0 && eligibleAlternatives[index - 1].comparedMetricValue === alt.comparedMetricValue;
      const isTieWithNext =
        index < eligibleCount - 1 &&
        eligibleAlternatives[index + 1].comparedMetricValue === alt.comparedMetricValue;
      alt.isTie = isTieWithPrev || isTieWithNext;

      // 자격 충족 대안 >= 2일 때만 최저비용 추천 및 차액 표시
      if (hasMultipleEligible) {
        if (index === 0) {
          alt.isRecommended = true;
          alt.deltaVsBest = 0;
        } else {
          alt.isRecommended = false;
          alt.deltaVsBest = alt.comparedMetricValue - bestValue;
        }

        if (baselineValue !== null) {
          alt.savingsIfChosen = baselineValue - alt.comparedMetricValue;
        }
      } else {
        // 단 1개의 대안만 적격한 경우: 최저비용 추천 배지 및 차액 미노출
        alt.isRecommended = false;
        alt.deltaVsBest = 0;
        alt.savingsIfChosen = 0;
      }
    });
  }

  // 6. 비적격 대안 속성 보증 (절대 추천 금지 불변식)
  ineligibleAlternatives.forEach((alt) => {
    alt.rank = null;
    alt.isRecommended = false;
    alt.isTie = false;
    alt.deltaVsBest = null;
    alt.savingsIfChosen = null;
  });

  // 7. 전체 목록 및 그룹 분리
  const rankedList = [...eligibleAlternatives, ...ineligibleAlternatives];
  const refundGroup = rankedList.filter((a) => a.category === 'REFUND_GROUP');
  const exchangeGroup = rankedList.filter((a) => a.category === 'EXCHANGE_GROUP');

  // 8. 사용자 비교 안내 메시지 생성
  let comparisonNotice = '';
  if (eligibleCount === 0) {
    comparisonNotice =
      '조건을 충족하는 적격 처리 대안이 없습니다. 귀책 사유 및 고객 요청을 먼저 확인해 주세요.';
  } else if (eligibleCount === 1) {
    comparisonNotice = `유일하게 적격한 1개 대안(${bestAlternative?.name})만 확인되었습니다. 비교 대상 대안이 없어 차액을 표시하지 않습니다.`;
  } else {
    const secondBestDelta =
      eligibleAlternatives[1].comparedMetricValue - (bestAlternative?.comparedMetricValue ?? 0);
    const metricLabel = metric === 'ECONOMIC_COST' ? '순경제비용' : '현금 지출';
    comparisonNotice = `${bestAlternative?.name} 대안이 ${metricLabel} 기준 최적 처리 방식으로 산출되었습니다 (차상위 대비 ${secondBestDelta.toLocaleString('ko-KR')}원 절감).`;
  }

  return {
    metric,
    eligibleCount,
    totalAlternatives: 4,
    bestAlternative: hasMultipleEligible ? bestAlternative : (eligibleCount === 1 ? bestAlternative : undefined),
    rankedList,
    refundGroup,
    exchangeGroup,
    hasMultipleEligible,
    comparisonNotice,
    globalWarnings: eligibility.globalWarnings,
  };
}
