import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAllEligibility } from '../../src/domain/eligibility';
import { compareAlternatives } from '../../src/domain/compare';
import type { DecisionFlags } from '../../src/domain/types';

const confirmed: DecisionFlags = {
  reason: 'BUYER_REMORSE',
  buyerRequest: 'REFUND',
  platform: 'NAVER',
  policyReviewed: true,
  rightsReviewed: true,
};

describe('Audit P0 | review confirmation must fail closed', () => {
  for (const [label, patch] of [
    ['market policy not reviewed', { policyReviewed: false }],
    ['statutory rights not reviewed', { rightsReviewed: false }],
    ['unknown marketplace', { platform: 'OTHER' as const }],
  ] as const) {
    it(label + ': none of the four alternatives may be recommended', () => {
      const flags: DecisionFlags = { ...confirmed, ...patch };
      const eligibility = evaluateAllEligibility(flags);
      assert.equal(eligibility.eligibleAlternatives.length, 0);
      const result = compareAlternatives(
        { refundAmount: 30000, reverseShippingSellerCost: 3500, recoveredItemNetValue: 9000 },
        flags
      );
      assert.equal(result.eligibleCount, 0);
      assert.equal(result.bestAlternative, undefined);
      assert.equal(result.rankedList.every(item => !item.rankingEligible && !item.isRecommended), true);
      assert.ok(result.globalWarnings.length > 0);
    });
  }

  it('documented policy and rights checks preserve ordinary comparison', () => {
    const result = compareAlternatives({ refundAmount: 30000 }, confirmed);
    assert.equal(result.eligibleCount, 2);
  });

  it('review checks must not override a pre-existing INELIGIBLE status', () => {
    const result = evaluateAllEligibility({ ...confirmed, policyReviewed: false });
    assert.equal(result.evaluations.KEEP_PARTIAL.status, 'INELIGIBLE');
    assert.equal(result.evaluations.EXCHANGE.status, 'INELIGIBLE');
  });
});
