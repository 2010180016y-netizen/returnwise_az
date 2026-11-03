import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compareAlternatives } from '../../src/domain/compare';
import { DecisionFlags, ScenarioInput } from '../../src/domain/types';

describe('T09 | Alternative Comparison & Ranking Logic', () => {
  const baseInputs: ScenarioInput = {
    refundAmount: 30000,
    reverseShippingSellerCost: 3500,
    handlingCost: 1000,
    recoveredItemNetValue: 9000,
    feeReversalCredit: 0,
    additionalSellerCost: 0,
    agreedPartialRefund: 15000,
    replacementCost: 12000,
    replacementOutboundShipping: 3000,
  };

  describe('1. eligible 대안 개수별 동작 검증 (0개 / 1개 / 2개 이상)', () => {
    it('eligible 0개일 때: 최저비용 추천이 없고 모든 대안의 rank가 null이어야 한다 (L01)', () => {
      const flags: DecisionFlags = {
        reason: 'UNKNOWN_REASON',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: false,
        rightsReviewed: false,
      };

      const result = compareAlternatives(baseInputs, flags, 'ECONOMIC_COST');
      assert.equal(result.eligibleCount, 0);
      assert.equal(result.hasMultipleEligible, false);
      assert.equal(result.bestAlternative, undefined);
      assert.equal(
        result.rankedList.every((a) => a.rank === null && a.isRecommended === false),
        true
      );
      assert.equal(result.comparisonNotice.includes('적격 처리 대안이 없습니다'), true);
    });

    it('eligible 1개일 때: 유일 대안에 rank 1이 부여되지만 비교 대상이 없어 isRecommended는 false여야 한다', () => {
      const flags: DecisionFlags = {
        reason: 'SELLER_FAULT',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
        voluntaryAgreementConfirmed: false, // 부분환불 제외
        buyerAgreedExchange: false, // 교환 제외
        isSpecialItem: true, // 특례품목에서는 회수 없는 환급도 개별 검토
      };
      // RETURN_FULL만 적격인 정당한 단일 선택지 예시
      const inputs: ScenarioInput = {
        ...baseInputs,
        reverseShippingBuyerCost: 0,
      };

      const result = compareAlternatives(inputs, flags, 'ECONOMIC_COST');
      assert.equal(result.eligibleCount, 1);
      assert.equal(result.hasMultipleEligible, false);
      assert.equal(result.bestAlternative?.alternative, 'RETURN_FULL');
      assert.equal(result.bestAlternative?.rank, 1);
      assert.equal(result.bestAlternative?.isRecommended, false); // 비교 대상 없으므로 false
      assert.equal(result.bestAlternative?.deltaVsBest, 0);
      assert.equal(result.comparisonNotice.includes('유일하게 적격한 1개 대안'), true);
    });

    it('eligible 2개 이상일 때: 1위에 isRecommended 배지가 달리고 차상위 차액(delta)이 계산되어야 한다', () => {
      const flags: DecisionFlags = {
        reason: 'BUYER_REMORSE',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
        voluntaryAgreementConfirmed: false, // KEEP_PARTIAL 제외
        buyerAgreedExchange: false, // EXCHANGE 제외 -> RETURN_FULL과 KEEP_FULL 2개 적격
      };

      const result = compareAlternatives(baseInputs, flags, 'ECONOMIC_COST');
      assert.equal(result.eligibleCount, 2);
      assert.equal(result.hasMultipleEligible, true);
      assert.equal(result.bestAlternative?.alternative, 'RETURN_FULL');
      assert.equal(result.bestAlternative?.isRecommended, true);
      assert.equal(result.bestAlternative?.deltaVsBest, 0);

      const second = result.rankedList.find((a) => a.rank === 2);
      assert.equal(second?.alternative, 'KEEP_FULL');
      // economicCost: RETURN_FULL(25,500) vs KEEP_FULL(30,000) -> delta: 4,500
      assert.equal(second?.deltaVsBest, 4500);
      assert.equal(second?.isRecommended, false);
    });
  });

  describe('2. 현금(cashOutflow) vs 경제적(economicCost) 지표 분리 검증', () => {
    it('ECONOMIC_COST 기준: 회수가치가 반영되어 RETURN_FULL(25,500원)이 1위여야 한다', () => {
      const flags: DecisionFlags = {
        reason: 'BUYER_REMORSE',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
      };

      const result = compareAlternatives(baseInputs, flags, 'ECONOMIC_COST');
      assert.equal(result.metric, 'ECONOMIC_COST');
      assert.equal(result.bestAlternative?.alternative, 'RETURN_FULL');
      assert.equal(result.bestAlternative?.comparedMetricValue, 25500);
    });

    it('CASH_OUTFLOW 기준: 순수 현금 유출만 비교되어 KEEP_FULL(30,000원)이 RETURN_FULL(34,500원)을 제치고 1위여야 한다', () => {
      const flags: DecisionFlags = {
        reason: 'BUYER_REMORSE',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
      };

      const result = compareAlternatives(baseInputs, flags, 'CASH_OUTFLOW');
      assert.equal(result.metric, 'CASH_OUTFLOW');
      assert.equal(result.bestAlternative?.alternative, 'KEEP_FULL');
      assert.equal(result.bestAlternative?.comparedMetricValue, 30000);

      const returnFull = result.rankedList.find((a) => a.alternative === 'RETURN_FULL');
      assert.equal(returnFull?.comparedMetricValue, 34500);
      assert.equal(returnFull?.deltaVsBest, 4500); // 34500 - 30000
    });
  });

  describe('3. 3대 요건 충족 시 KEEP_PARTIAL의 최저비용 선정 검증 (C03)', () => {
    it('소비자 합의된 부분환급(15,000원)이 두 기준 모두에서 압도적 1위로 추천되어야 한다', () => {
      const flags: DecisionFlags = {
        reason: 'BUYER_REMORSE',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
        voluntaryAgreementConfirmed: true, // 3요건 충족
        permittedByPolicyConfirmed: true,
        rightsNotRestrictedConfirmed: true,
      };

      const result = compareAlternatives(baseInputs, flags, 'ECONOMIC_COST');
      assert.equal(result.bestAlternative?.alternative, 'KEEP_PARTIAL');
      assert.equal(result.bestAlternative?.comparedMetricValue, 15000);
      assert.equal(result.bestAlternative?.isRecommended, true);

      // 차상위 RETURN_FULL(25,500)과의 차액 10,500원
      const second = result.rankedList.find((a) => a.rank === 2);
      assert.equal(second?.alternative, 'RETURN_FULL');
      assert.equal(second?.deltaVsBest, 10500);
    });
  });

  describe('4. 비적격 대안 속성 및 안전 가드레일 검증', () => {
    it('비적격 대안(L06 교환 비동의)은 회색 비활성화되며 절대 isRecommended가 true가 될 수 없다', () => {
      const flags: DecisionFlags = {
        reason: 'BUYER_REMORSE',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
      };

      const result = compareAlternatives(baseInputs, flags, 'ECONOMIC_COST');
      const exchange = result.rankedList.find((a) => a.alternative === 'EXCHANGE');

      assert.equal(exchange?.rankingEligible, false);
      assert.equal(exchange?.rank, null);
      assert.equal(exchange?.isRecommended, false);
      assert.equal(exchange?.deltaVsBest, null);
      assert.equal((exchange?.reasons.length ?? 0) > 0, true);
    });
  });

  describe('5. 동점(Tie) 처리 및 카테고리 분리 검증', () => {
    it('비용이 완전히 동일한 대안은 isTie가 true로 표기되어야 한다', () => {
      const tieInputs: ScenarioInput = {
        refundAmount: 30000,
        reverseShippingSellerCost: 0,
        handlingCost: 0,
        recoveredItemNetValue: 0,
        feeReversalCredit: 0,
        additionalSellerCost: 0,
        agreedPartialRefund: 30000, // KEEP_PARTIAL도 30,000원
      };
      const flags: DecisionFlags = {
        reason: 'BUYER_REMORSE',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
        voluntaryAgreementConfirmed: true,
        permittedByPolicyConfirmed: true,
        rightsNotRestrictedConfirmed: true,
      };

      const result = compareAlternatives(tieInputs, flags, 'ECONOMIC_COST');
      const rank1 = result.rankedList.find((a) => a.rank === 1);
      const rank2 = result.rankedList.find((a) => a.rank === 2);

      assert.equal(rank1?.comparedMetricValue, rank2?.comparedMetricValue);
      assert.equal(rank1?.isTie, true);
      assert.equal(rank2?.isTie, true);
    });

    it('환불군(3개)과 교환군(1개)이 올바르게 분리되어야 한다', () => {
      const flags: DecisionFlags = {
        reason: 'BUYER_REMORSE',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
      };

      const result = compareAlternatives(baseInputs, flags, 'ECONOMIC_COST');
      assert.equal(result.refundGroup.length, 3);
      assert.equal(result.exchangeGroup.length, 1);
      assert.equal(result.exchangeGroup[0].alternative, 'EXCHANGE');
    });
  });
});
