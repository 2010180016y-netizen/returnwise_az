import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ReturnInputs } from '../../src/domain/types';

describe('Project Scaffold Smoke Test', () => {
  it('should import pure domain types without runtime errors', () => {
    const input: ReturnInputs = {
      refundAmount: 30000,
      reverseShippingSellerCost: 3500,
    };
    assert.equal(input.refundAmount, 30000);
    assert.equal(input.reverseShippingSellerCost, 3500);
  });
});
