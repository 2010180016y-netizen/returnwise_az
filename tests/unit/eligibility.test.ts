import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateReturnFullEligibility,
  evaluateKeepFullEligibility,
  evaluateKeepPartialEligibility,
  evaluateExchangeEligibility,
  evaluateAllEligibility,
} from '../../src/domain/eligibility';
import { DecisionFlags, ReturnInputs } from '../../src/domain/types';

describe('T08 | Option Eligibility & Policy Gate Engine (L01~L08)', () => {
  describe('1. 8대 안전/적법성 게이트 시나리오 (L01~L08)', () => {
    it('L01: 귀책 사유 미확인 시 모든 대안의 추천이 원천 차단되어야 한다', () => {
      const flags: DecisionFlags = {
        reason: 'UNKNOWN_REASON',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: false,
        rightsReviewed: false,
      };

      const result = evaluateAllEligibility(flags);
      assert.equal(result.eligibleAlternatives.length, 0);
      assert.equal(result.evaluations.RETURN_FULL.rankingEligible, false);
      assert.equal(result.evaluations.KEEP_FULL.rankingEligible, false);
      assert.equal(result.evaluations.KEEP_PARTIAL.rankingEligible, false);
      assert.equal(result.evaluations.EXCHANGE.rankingEligible, false);
      assert.equal(result.evaluations.RETURN_FULL.status, 'REQUIRES_REVIEW');
      assert.equal(result.evaluations.KEEP_PARTIAL.status, 'INELIGIBLE');
      assert.equal(
        result.globalWarnings.some((w) => w.includes('L01')),
        true
      );
    });

    it('L02: 판매자 귀책인데 구매자에게 배송비를 전가하면 RETURN_FULL이 차단되어야 한다', () => {
      const flags: DecisionFlags = {
        reason: 'SELLER_FAULT',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
      };
      const inputs: ReturnInputs = {
        reverseShippingBuyerCost: 3500, // 고객 전가 시도
      };

      const evaluation = evaluateReturnFullEligibility(flags, inputs);
      assert.equal(evaluation.status, 'INELIGIBLE');
      assert.equal(evaluation.rankingEligible, false);
      assert.equal(
        evaluation.reasons.some((r) => r.includes('전자상거래법 제18조 제9항')),
        true
      );
    });

    it('L03: 부분환불 고객 자발적 합의 부재 시 KEEP_PARTIAL이 추천에서 제외되어야 한다', () => {
      const flags: DecisionFlags = {
        reason: 'BUYER_REMORSE',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
        voluntaryAgreementConfirmed: false, // 합의 부재
        permittedByPolicyConfirmed: true,
        rightsNotRestrictedConfirmed: true,
      };

      const evaluation = evaluateKeepPartialEligibility(flags);
      assert.equal(evaluation.status, 'INELIGIBLE');
      assert.equal(evaluation.rankingEligible, false);
      assert.equal(
        evaluation.reasons.some((r) => r.includes('자발적 합의')),
        true
      );
    });

    it('L04: 마켓 약관상 부분환불 절차 미확인 시 KEEP_PARTIAL이 추천에서 제외되어야 한다', () => {
      const flags: DecisionFlags = {
        reason: 'BUYER_REMORSE',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
        voluntaryAgreementConfirmed: true,
        permittedByPolicyConfirmed: false, // 마켓 약관 미확인
        rightsNotRestrictedConfirmed: true,
      };

      const evaluation = evaluateKeepPartialEligibility(flags);
      assert.equal(evaluation.status, 'INELIGIBLE');
      assert.equal(evaluation.rankingEligible, false);
      assert.equal(
        evaluation.reasons.some((r) => r.includes('마켓의 약관')),
        true
      );
    });

    it('L05: 법정 청약철회권 비침해 미확인 시 KEEP_PARTIAL이 추천에서 제외되어야 한다', () => {
      const flags: DecisionFlags = {
        reason: 'BUYER_REMORSE',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
        voluntaryAgreementConfirmed: true,
        permittedByPolicyConfirmed: true,
        rightsNotRestrictedConfirmed: false, // 권리 비침해 미확인
      };

      const evaluation = evaluateKeepPartialEligibility(flags);
      assert.equal(evaluation.status, 'INELIGIBLE');
      assert.equal(evaluation.rankingEligible, false);
      assert.equal(
        evaluation.reasons.some((r) => r.includes('청약철회 권리')),
        true
      );
    });

    it('L06: 환불 요청 고객에게 사전 동의 없는 교환 추천은 강요 방지를 위해 차단되어야 한다', () => {
      const flags: DecisionFlags = {
        reason: 'BUYER_REMORSE',
        buyerRequest: 'REFUND', // 환불 요청
        buyerAgreedExchange: false, // 교환 미동의
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
      };

      const evaluation = evaluateExchangeEligibility(flags);
      assert.equal(evaluation.status, 'INELIGIBLE');
      assert.equal(evaluation.rankingEligible, false);
      assert.equal(
        evaluation.reasons.some((r) => r.includes('L06')),
        true
      );
    });

    it('L07: 특례 품목(식품/위생 등) 플래그 시 글로벌 경고 및 KEEP_FULL 검토 전환', () => {
      const flags: DecisionFlags = {
        reason: 'BUYER_REMORSE',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
        isSpecialItem: true, // 특례 품목
      };

      const directKeepFull = evaluateKeepFullEligibility(flags);
      assert.equal(directKeepFull.status, 'REQUIRES_REVIEW');
      assert.equal(directKeepFull.rankingEligible, false);

      const result = evaluateAllEligibility(flags);
      assert.equal(result.hasSpecialItemWarning, true);
      assert.equal(result.evaluations.KEEP_FULL.status, 'REQUIRES_REVIEW');
      assert.equal(result.evaluations.KEEP_FULL.rankingEligible, false);
      assert.equal(
        result.globalWarnings.some((w) => w.includes('특례 품목')),
        true
      );
    });

    it('L08: 정책 안전 모드 활성화 시 특수 대안(KEEP_PARTIAL 등)이 비활성화되어야 한다', () => {
      const flags: DecisionFlags = {
        reason: 'BUYER_REMORSE',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
        voluntaryAgreementConfirmed: true,
        permittedByPolicyConfirmed: true,
        rightsNotRestrictedConfirmed: true,
        isPolicyOutdated: true, // 정책 만료 안전 모드
      };

      const result = evaluateAllEligibility(flags);
      assert.equal(result.isSafeModeActive, true);
      assert.equal(result.evaluations.KEEP_PARTIAL.status, 'INELIGIBLE');
      assert.equal(result.evaluations.KEEP_PARTIAL.rankingEligible, false);
      assert.equal(result.evaluations.KEEP_FULL.status, 'REQUIRES_REVIEW');
      assert.equal(
        result.globalWarnings.some((w) => w.includes('안전 모드')),
        true
      );
    });
  });

  describe('2. 적격 대안 세트 및 필터링 무결성 검증', () => {
    it('3대 요건 모두 충족 시 KEEP_PARTIAL이 ELIGIBLE로 추천 후보에 포함되어야 한다 (C03)', () => {
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

      const result = evaluateAllEligibility(flags);
      assert.equal(result.evaluations.KEEP_PARTIAL.status, 'ELIGIBLE');
      assert.equal(result.evaluations.KEEP_PARTIAL.rankingEligible, true);
      assert.equal(result.eligibleAlternatives.includes('KEEP_PARTIAL'), true);
      assert.equal(result.eligibleAlternatives.includes('RETURN_FULL'), true);
      assert.equal(result.eligibleAlternatives.includes('KEEP_FULL'), true);
      assert.equal(result.eligibleAlternatives.includes('EXCHANGE'), false); // L06 환불요청으로 제외
    });

    it('고객이 교환을 요청하거나 합의한 경우 EXCHANGE가 ELIGIBLE로 승인되어야 한다 (C15)', () => {
      const flags: DecisionFlags = {
        reason: 'SELLER_FAULT',
        buyerRequest: 'EXCHANGE',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
      };

      const evaluation = evaluateExchangeEligibility(flags);
      assert.equal(evaluation.status, 'ELIGIBLE');
      assert.equal(evaluation.rankingEligible, true);
    });

    it('모든 비적격(INELIGIBLE, REQUIRES_REVIEW) 대안은 eligibleAlternatives 배열에서 완전히 배제되어야 한다', () => {
      const flags: DecisionFlags = {
        reason: 'BUYER_REMORSE',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
        // 부분환불 3요건 미제공 -> INELIGIBLE
      };

      const result = evaluateAllEligibility(flags);
      for (const alt of result.eligibleAlternatives) {
        assert.equal(result.evaluations[alt].status, 'ELIGIBLE');
        assert.equal(result.evaluations[alt].rankingEligible, true);
      }

      assert.equal(result.eligibleAlternatives.includes('KEEP_PARTIAL'), false);
      assert.equal(result.eligibleAlternatives.includes('EXCHANGE'), false);
    });

    it('차단된 대안은 반드시 1개 이상의 구체적인 사유(reasons)를 포함해야 한다', () => {
      const flags: DecisionFlags = {
        reason: 'BUYER_REMORSE',
        buyerRequest: 'REFUND',
        platform: 'NAVER',
        policyReviewed: true,
        rightsReviewed: true,
      };

      const result = evaluateAllEligibility(flags);
      for (const evaluation of Object.values(result.evaluations)) {
        if (evaluation.status !== 'ELIGIBLE') {
          assert.equal(
            evaluation.reasons.length > 0,
            true,
            `${evaluation.alternative} has no explanation reasons`
          );
        }
      }
    });
  });
});
