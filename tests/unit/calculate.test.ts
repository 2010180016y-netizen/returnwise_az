import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateReturnFull,
  calculateKeepFull,
  calculateKeepPartial,
  calculateExchange,
  calculateAllAlternatives,
  verifyLineItemsIntegrity,
} from '../../src/domain/calculate';
import { ScenarioInput } from '../../src/domain/types';

describe('T07 | Pure Return & Exchange Cost Calculation Engine', () => {
  describe('1. 4대 대안별 핵심 시나리오 수치 정확성 검증 (C01, C02, C03, C15)', () => {
    it('C01: 표준 회수 후 전액환급 (cashOutflow: 34,500, economicCost: 25,500)', () => {
      const input: ScenarioInput = {
        refundAmount: 30000,
        reverseShippingSellerCost: 3500,
        handlingCost: 1000,
        recoveredItemNetValue: 9000,
        feeReversalCredit: 0,
        additionalSellerCost: 0,
      };

      const res = calculateReturnFull(input);
      assert.equal(res.cashOutflow, 34500);
      assert.equal(res.economicCost, 25500);
      assert.equal(verifyLineItemsIntegrity(res), true);
    });

    it('C02: 회수 없는 전액환급 (cashOutflow: 30,000, economicCost: 30,000)', () => {
      const input: ScenarioInput = {
        refundAmount: 30000,
        additionalSellerCost: 0,
        feeReversalCredit: 0,
      };

      const res = calculateKeepFull(input);
      assert.equal(res.cashOutflow, 30000);
      assert.equal(res.economicCost, 30000);
      assert.equal(verifyLineItemsIntegrity(res), true);
    });

    it('C03: 소비자 합의 부분환급 (cashOutflow: 15,000, economicCost: 15,000)', () => {
      const input: ScenarioInput = {
        agreedPartialRefund: 15000,
        additionalSellerCost: 0,
        feeReversalCredit: 0,
      };

      const res = calculateKeepPartial(input);
      assert.equal(res.cashOutflow, 15000);
      assert.equal(res.economicCost, 15000);
      assert.equal(verifyLineItemsIntegrity(res), true);
    });

    it('C15: 1:1 교환 처리 공식 (cashOutflow: 19,500, economicCost: 10,500)', () => {
      const input: ScenarioInput = {
        replacementCost: 12000,
        reverseShippingSellerCost: 3500,
        replacementOutboundShipping: 3000,
        handlingCost: 1000,
        recoveredItemNetValue: 9000,
        feeReversalCredit: 0,
        additionalSellerCost: 0,
      };

      const res = calculateExchange(input);
      assert.equal(res.cashOutflow, 19500);
      assert.equal(res.economicCost, 10500);
      assert.equal(verifyLineItemsIntegrity(res), true);
    });
  });

  describe('2. 수수료 및 회수가치 델타 불변식 검증 (C05, C06, C07, C08, C09, C18)', () => {
    it('C05 & C18: 확정 수수료 크레딧 1,000원 발생 시 cashOutflow와 economicCost 모두 1,000원 감소', () => {
      const inputBase: ScenarioInput = {
        refundAmount: 30000,
        reverseShippingSellerCost: 3500,
        handlingCost: 1000,
        recoveredItemNetValue: 9000,
        feeReversalCredit: 0,
      };
      const inputWithCredit: ScenarioInput = {
        ...inputBase,
        feeReversalCredit: 1000,
      };

      const base = calculateReturnFull(inputBase);
      const withCredit = calculateReturnFull(inputWithCredit);

      assert.equal(base.cashOutflow - withCredit.cashOutflow, 1000);
      assert.equal(base.economicCost - withCredit.economicCost, 1000);
      assert.equal(withCredit.cashOutflow, 33500);
      assert.equal(withCredit.economicCost, 24500);
    });

    it('C06: 회수가치 0원일 때 cashOutflow와 economicCost가 완전히 일치해야 한다', () => {
      const input: ScenarioInput = {
        refundAmount: 30000,
        reverseShippingSellerCost: 3500,
        handlingCost: 1000,
        recoveredItemNetValue: 0,
      };

      const res = calculateReturnFull(input);
      assert.equal(res.cashOutflow, 34500);
      assert.equal(res.economicCost, 34500);
    });

    it('C07: 회수가치 10,000원 증가 시 economicCost만 10,000원 감소하고 cashOutflow는 불변이어야 한다', () => {
      const inputA: ScenarioInput = {
        refundAmount: 30000,
        reverseShippingSellerCost: 3500,
        handlingCost: 1000,
        recoveredItemNetValue: 9000,
      };
      const inputB: ScenarioInput = {
        ...inputA,
        recoveredItemNetValue: 19000,
      };

      const resA = calculateReturnFull(inputA);
      const resB = calculateReturnFull(inputB);

      assert.equal(resA.cashOutflow, resB.cashOutflow); // cashOutflow 불변
      assert.equal(resA.economicCost - resB.economicCost, 10000); // 10,000원 감소
    });

    it('C08: 판매자부담 운임 1,000원 증가 시 cashOutflow와 economicCost 모두 1,000원 증가해야 한다', () => {
      const inputA: ScenarioInput = {
        refundAmount: 30000,
        reverseShippingSellerCost: 3500,
        handlingCost: 1000,
        recoveredItemNetValue: 9000,
      };
      const inputB: ScenarioInput = {
        ...inputA,
        reverseShippingSellerCost: 4500,
      };

      const resA = calculateReturnFull(inputA);
      const resB = calculateReturnFull(inputB);

      assert.equal(resB.cashOutflow - resA.cashOutflow, 1000);
      assert.equal(resB.economicCost - resA.economicCost, 1000);
    });

    it('C09: 고객부담 운송비(3,500원)는 판매자 추가 비용에 절대 합산되지 않아야 한다', () => {
      const input: ScenarioInput = {
        refundAmount: 30000,
        reverseShippingSellerCost: 0,
        reverseShippingBuyerCost: 3500, // 고객 부담분
        handlingCost: 1000,
        recoveredItemNetValue: 9000,
      };

      const res = calculateReturnFull(input);
      assert.equal(res.cashOutflow, 31000); // 30000 + 1000
      assert.equal(res.economicCost, 22000); // 31000 - 9000
    });
  });

  describe('3. 공통 기발생 원가 배제 및 경계값 검증 (C10, C14)', () => {
    it('C10: 모든 금액 필드에 명시적 0원 입력 시 0원을 반환해야 한다', () => {
      const input: ScenarioInput = {
        refundAmount: 0,
        reverseShippingSellerCost: 0,
        handlingCost: 0,
        recoveredItemNetValue: 0,
        feeReversalCredit: 0,
        additionalSellerCost: 0,
      };

      const res = calculateReturnFull(input);
      assert.equal(res.cashOutflow, 0);
      assert.equal(res.economicCost, 0);
      assert.equal(verifyLineItemsIntegrity(res), true);
    });

    it('C14: 기발생 상품 매입원가(20,000원)는 추가비용에 중복 합산되지 않아야 한다', () => {
      const inputWithProcurement: ScenarioInput = {
        initialProcurementCost: 20000, // 매몰원가
        refundAmount: 30000,
        reverseShippingSellerCost: 3500,
        handlingCost: 1000,
        recoveredItemNetValue: 9000,
      };

      const res = calculateReturnFull(inputWithProcurement);
      assert.equal(res.cashOutflow, 34500);
      assert.equal(res.economicCost, 25500);
    });
  });

  describe('4. 통합 계산 엔진 불변식 검증 (C17, Mutation 방지, 정렬 안정성)', () => {
    it('C17: 동일 입력에 대해 100회 반복 계산해도 완전히 동일한 결과를 반환해야 한다 (결정성)', () => {
      const input: ScenarioInput = {
        refundAmount: 30000,
        reverseShippingSellerCost: 3500,
        handlingCost: 1000,
        recoveredItemNetValue: 9000,
        agreedPartialRefund: 15000,
        replacementCost: 12000,
        replacementOutboundShipping: 3000,
      };

      const first = calculateAllAlternatives(input);

      for (let i = 0; i < 100; i++) {
        const next = calculateAllAlternatives(input);
        assert.deepEqual(next, first);
      }
    });

    it('입력 객체를 절대 수정(mutate)하지 않아야 한다 (불변성)', () => {
      const originalInput: Readonly<ScenarioInput> = Object.freeze({
        refundAmount: 30000,
        reverseShippingSellerCost: 3500,
        handlingCost: 1000,
        recoveredItemNetValue: 9000,
      });

      const clone = { ...originalInput };
      calculateAllAlternatives(originalInput);

      assert.deepEqual(originalInput, clone);
    });

    it('sortedAlternatives는 economicCost 오름차순으로 안정적으로 정렬되어야 한다', () => {
      const input: ScenarioInput = {
        refundAmount: 30000,
        reverseShippingSellerCost: 3500,
        handlingCost: 1000,
        recoveredItemNetValue: 9000,
        agreedPartialRefund: 15000,
        replacementCost: 12000,
        replacementOutboundShipping: 3000,
      };

      const res = calculateAllAlternatives(input);
      const sorted = res.sortedAlternatives;

      assert.equal(sorted.length, 4);
      for (let i = 0; i < sorted.length - 1; i++) {
        assert.equal(
          sorted[i].economicCost <= sorted[i + 1].economicCost,
          true,
          `Sort order violation between ${sorted[i].alternative} and ${sorted[i + 1].alternative}`
        );
      }
    });

    it('모든 대안의 원장 항목(lineItems) 합은 cashOutflow 및 economicCost와 100% 일치해야 한다', () => {
      const input: ScenarioInput = {
        refundAmount: 30000,
        reverseShippingSellerCost: 3500,
        handlingCost: 1000,
        recoveredItemNetValue: 9000,
        agreedPartialRefund: 15000,
        replacementCost: 12000,
        replacementOutboundShipping: 3000,
        feeReversalCredit: 1000,
        additionalSellerCost: 500,
      };

      const res = calculateAllAlternatives(input);
      for (const breakdown of Object.values(res.results)) {
        assert.equal(
          verifyLineItemsIntegrity(breakdown),
          true,
          `Integrity failed for ${breakdown.alternative}`
        );
      }
    });
  });
});
