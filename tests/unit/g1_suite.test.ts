import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { calculateAllAlternatives, calculateReturnFull, calculateKeepFull, calculateKeepPartial, calculateExchange } from '../../src/domain/calculate';
import { evaluateAllEligibility, evaluateReturnFullEligibility } from '../../src/domain/eligibility';
import { compareAlternatives } from '../../src/domain/compare';
import { parseMoney } from '../../src/domain/money';
import { ScenarioInput, AlternativeCode } from '../../src/domain/types';

// Load JSON fixtures relative to process.cwd()
const calcFixturesPath = path.resolve(process.cwd(), 'tests/fixtures/scenarios.json');
const legalFixturesPath = path.resolve(process.cwd(), 'tests/fixtures/legal_scenarios.json');

const calcFixtures = JSON.parse(fs.readFileSync(calcFixturesPath, 'utf-8')).fixtures;
const legalFixtures = JSON.parse(fs.readFileSync(legalFixturesPath, 'utf-8')).fixtures;

describe('T10 | G1 Gate Comprehensive Regression & Property Suite', () => {
  describe('1. 18대 계산 회귀 시나리오 전수 검증 (C01~C18 Fixtures)', () => {
    it('C01: 표준 회수 후 전액환급 기본 시나리오', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C01');
      const res = calculateReturnFull(f.inputs);
      assert.equal(res.cashOutflow, f.expected.cashOutflow);
      assert.equal(res.economicCost, f.expected.economicCost);
    });

    it('C02: 회수 없는 전액환급 시나리오', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C02');
      const res = calculateKeepFull(f.inputs);
      assert.equal(res.cashOutflow, f.expected.cashOutflow);
      assert.equal(res.economicCost, f.expected.economicCost);
    });

    it('C03: 소비자 합의된 부분환급 시나리오', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C03');
      const res = calculateKeepPartial(f.inputs);
      assert.equal(res.cashOutflow, f.expected.cashOutflow);
      assert.equal(res.economicCost, f.expected.economicCost);
    });

    it('C04: 부분환불 합의 미확인 시 추천 후보 제외', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C04');
      const result = compareAlternatives(f.inputs, f.flags);
      const keepPartial = result.rankedList.find((a) => a.alternative === 'KEEP_PARTIAL');
      assert.equal(keepPartial?.rankingEligible, f.expected.rankingEligible);
      assert.equal(keepPartial?.rank, null);
    });

    it('C05: 수수료 환급 1,000원 확인 시 현금/경제비용 각 1,000원 감소', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C05');
      const res = calculateReturnFull(f.inputs);
      assert.equal(res.cashOutflow, f.expected.cashOutflow);
      assert.equal(res.economicCost, f.expected.economicCost);
    });

    it('C06: 회수가치 0원일 때 현금지출과 순경제비용 일치', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C06');
      const res = calculateReturnFull(f.inputs);
      assert.equal(res.cashOutflow, f.expected.cashOutflow);
      assert.equal(res.economicCost, f.expected.economicCost);
    });

    it('C07: 회수가치 10,000원 증가 시 economicCost만 10,000원 감소하고 cashOutflow 불변', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C07');
      const res = calculateReturnFull(f.inputs);
      assert.equal(res.cashOutflow, f.expected.cashOutflow);
      assert.equal(res.economicCost, f.expected.economicCost);
    });

    it('C08: 판매자부담 운임 1,000원 증가 시 cashOutflow와 economicCost 모두 1,000원 증가', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C08');
      const res = calculateReturnFull(f.inputs);
      assert.equal(res.cashOutflow, f.expected.cashOutflow);
      assert.equal(res.economicCost, f.expected.economicCost);
    });

    it('C09: 고객부담 운송비 3,500원은 판매자 부담 비용에 합산되지 않음', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C09');
      const res = calculateReturnFull(f.inputs);
      assert.equal(res.cashOutflow, f.expected.cashOutflow);
      assert.equal(res.economicCost, f.expected.economicCost);
    });

    it('C10: 모든 금액 필드에 명시적 0원 입력 시 정상 계산(0원)', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C10');
      const res = calculateReturnFull(f.inputs);
      assert.equal(res.cashOutflow, f.expected.cashOutflow);
      assert.equal(res.economicCost, f.expected.economicCost);
    });

    it('C11: 음수, NaN, 소수점 입력 시 에러 반환 및 계산 차단', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C11');
      for (const item of f.invalidInputs) {
        const val = item.refundAmount;
        const res = parseMoney(val);
        assert.equal(res.success, false);
      }
    });

    it('C12: 필수 항목 미입력(undefined/빈문자열)과 0원 엄격 구분', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C12');
      for (const item of f.invalidInputs) {
        const res = parseMoney(item.refundAmount, { required: true });
        assert.equal(res.success, false);
        assert.equal(res.error, 'MISSING_REQUIRED');
      }
    });

    it('C13: 최대 허용 금액 경계값(1,000,000,000원) 통과 및 초과 거부', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C13');
      const validRes = parseMoney(f.inputs.refundAmount);
      assert.equal(validRes.success, true);
      assert.equal(validRes.value, 1_000_000_000);

      const invalidRes = parseMoney(f.invalidInputs[0].refundAmount);
      assert.equal(invalidRes.success, false);
      assert.equal(invalidRes.error, f.expected.overflowError);
    });

    it('C14: 기발생 상품 매입원가(20,000원)는 추가비용에 중복 합산되지 않음', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C14');
      const res = calculateReturnFull(f.inputs);
      assert.equal(res.cashOutflow, f.expected.cashOutflow);
      assert.equal(res.economicCost, f.expected.economicCost);
    });

    it('C15: 1:1 맞교환 처리 공식 검증', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C15');
      const res = calculateExchange(f.inputs);
      assert.equal(res.cashOutflow, f.expected.cashOutflow);
      assert.equal(res.economicCost, f.expected.economicCost);
    });

    it('C16: 고객이 전액환불 요구 시 교환(EXCHANGE) 대안 추천 제외', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C16');
      const result = compareAlternatives(f.inputs, f.flags);
      const exchange = result.rankedList.find((a) => a.alternative === 'EXCHANGE');
      assert.equal(exchange?.rankingEligible, f.expected.rankingEligible);
      assert.equal(exchange?.rank, null);
    });

    it('C17: 동일 입력에 대한 완전한 결정적 결과 보장 (100회 반복)', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C17');
      const first = calculateAllAlternatives(f.inputs);
      for (let i = 0; i < 100; i++) {
        const next = calculateAllAlternatives(f.inputs);
        assert.deepEqual(next, first);
      }
    });

    it('C18: 환급금액 30,000원에 확정 크레딧 유무 비교(정확히 1,000원 델타)', () => {
      const f = calcFixtures.find((x: { id: string }) => x.id === 'C18');
      const resA = calculateReturnFull(f.scenarioA);
      const resB = calculateReturnFull(f.scenarioB);
      assert.equal(resA.cashOutflow - resB.cashOutflow, f.expected.cashDelta);
      assert.equal(resA.economicCost - resB.economicCost, f.expected.economicDelta);
    });
  });

  describe('2. 8대 안전/적법성 게이트 전수 검증 (L01~L08 Fixtures)', () => {
    it('L01: 귀책 사유 미확인 차단', () => {
      const f = legalFixtures.find((x: { id: string }) => x.id === 'L01');
      const res = evaluateAllEligibility(f.flags);
      assert.equal(res.eligibleAlternatives.length, f.expected.eligibleCount);
      assert.equal(res.globalWarnings.some((w) => w.includes(f.expected.globalWarningKeyword)), true);
    });

    it('L02: 판매자 귀책 고객 전가 차단', () => {
      const f = legalFixtures.find((x: { id: string }) => x.id === 'L02');
      const evalItem = evaluateReturnFullEligibility(f.flags, f.inputs);
      assert.equal(evalItem.status, f.expected.status);
      assert.equal(evalItem.rankingEligible, f.expected.rankingEligible);
      assert.equal(evalItem.reasons.some((r) => r.includes(f.expected.reasonKeyword)), true);
    });

    it('L03: 부분환불 소비자 합의 부재 차단', () => {
      const f = legalFixtures.find((x: { id: string }) => x.id === 'L03');
      const res = evaluateAllEligibility(f.flags);
      const target = res.evaluations[f.expected.targetAlternative as AlternativeCode];
      assert.equal(target.status, f.expected.status);
      assert.equal(target.rankingEligible, f.expected.rankingEligible);
      assert.equal(target.reasons.some((r) => r.includes(f.expected.reasonKeyword)), true);
    });

    it('L04: 마켓 약관상 부분환불 절차 미확인 차단', () => {
      const f = legalFixtures.find((x: { id: string }) => x.id === 'L04');
      const res = evaluateAllEligibility(f.flags);
      const target = res.evaluations[f.expected.targetAlternative as AlternativeCode];
      assert.equal(target.status, f.expected.status);
      assert.equal(target.rankingEligible, f.expected.rankingEligible);
      assert.equal(target.reasons.some((r) => r.includes(f.expected.reasonKeyword)), true);
    });

    it('L05: 법정 청약철회권 비침해 미확인 차단', () => {
      const f = legalFixtures.find((x: { id: string }) => x.id === 'L05');
      const res = evaluateAllEligibility(f.flags);
      const target = res.evaluations[f.expected.targetAlternative as AlternativeCode];
      assert.equal(target.status, f.expected.status);
      assert.equal(target.rankingEligible, f.expected.rankingEligible);
      assert.equal(target.reasons.some((r) => r.includes(f.expected.reasonKeyword)), true);
    });

    it('L06: 교환 강요 차단', () => {
      const f = legalFixtures.find((x: { id: string }) => x.id === 'L06');
      const res = evaluateAllEligibility(f.flags);
      const target = res.evaluations[f.expected.targetAlternative as AlternativeCode];
      assert.equal(target.status, f.expected.status);
      assert.equal(target.rankingEligible, f.expected.rankingEligible);
      assert.equal(target.reasons.some((r) => r.includes(f.expected.reasonKeyword)), true);
    });

    it('L07: 특례 품목 전문 검토 안내', () => {
      const f = legalFixtures.find((x: { id: string }) => x.id === 'L07');
      const res = evaluateAllEligibility(f.flags);
      assert.equal(res.hasSpecialItemWarning, f.expected.hasSpecialItemWarning);
      const target = res.evaluations[f.expected.targetAlternative as AlternativeCode];
      assert.equal(target.status, f.expected.status);
      assert.equal(target.rankingEligible, f.expected.rankingEligible);
      assert.equal(res.globalWarnings.some((w) => w.includes(f.expected.globalWarningKeyword)), true);
    });

    it('L08: 정책 검증 만료 안전모드', () => {
      const f = legalFixtures.find((x: { id: string }) => x.id === 'L08');
      const res = evaluateAllEligibility(f.flags);
      assert.equal(res.isSafeModeActive, f.expected.isSafeModeActive);
      const target = res.evaluations[f.expected.targetAlternative as AlternativeCode];
      assert.equal(target.status, f.expected.status);
      assert.equal(target.rankingEligible, f.expected.rankingEligible);
      assert.equal(res.globalWarnings.some((w) => w.includes(f.expected.globalWarningKeyword)), true);
    });
  });

  describe('3. Property-based Invariant Testing (단조성, 분리성, 결정성 100회 랜덤 검증)', () => {
    it('단조성(Monotonicity): 판매자 운송비가 delta만큼 증가하면 cash와 economic 모두 정확히 delta만큼 증가한다', () => {
      for (let i = 0; i < 50; i++) {
        const baseRefund = Math.floor(Math.random() * 500000);
        const baseShipping = Math.floor(Math.random() * 50000);
        const delta = Math.floor(Math.random() * 10000) + 1;

        const input1: ScenarioInput = {
          refundAmount: baseRefund,
          reverseShippingSellerCost: baseShipping,
          handlingCost: 1000,
          recoveredItemNetValue: 5000,
        };
        const input2: ScenarioInput = {
          ...input1,
          reverseShippingSellerCost: baseShipping + delta,
        };

        const res1 = calculateReturnFull(input1);
        const res2 = calculateReturnFull(input2);

        assert.equal(res2.cashOutflow - res1.cashOutflow, delta);
        assert.equal(res2.economicCost - res1.economicCost, delta);
      }
    });

    it('분리 보존성(Separation Invariant): 회수 상품 순가치가 delta만큼 증가하면 economicCost만 delta 감소하고 cashOutflow는 0원도 변하지 않는다', () => {
      for (let i = 0; i < 50; i++) {
        const baseRefund = Math.floor(Math.random() * 500000);
        const baseValue = Math.floor(Math.random() * 100000);
        const delta = Math.floor(Math.random() * 20000) + 1;

        const input1: ScenarioInput = {
          refundAmount: baseRefund,
          reverseShippingSellerCost: 3500,
          recoveredItemNetValue: baseValue,
        };
        const input2: ScenarioInput = {
          ...input1,
          recoveredItemNetValue: baseValue + delta,
        };

        const res1 = calculateReturnFull(input1);
        const res2 = calculateReturnFull(input2);

        assert.equal(res1.cashOutflow, res2.cashOutflow); // cashOutflow 불변
        assert.equal(res1.economicCost - res2.economicCost, delta); // economicCost만 감소
      }
    });

    it('수수료 환급성(Fee Reversal): 수수료 환급액이 delta만큼 증가하면 cash와 economic 모두 정확히 delta 감소한다', () => {
      for (let i = 0; i < 50; i++) {
        const baseRefund = Math.floor(Math.random() * 500000);
        const baseCredit = Math.floor(Math.random() * 10000);
        const delta = Math.floor(Math.random() * 5000) + 1;

        const input1: ScenarioInput = {
          refundAmount: baseRefund,
          feeReversalCredit: baseCredit,
        };
        const input2: ScenarioInput = {
          ...input1,
          feeReversalCredit: baseCredit + delta,
        };

        const res1 = calculateReturnFull(input1);
        const res2 = calculateReturnFull(input2);

        assert.equal(res1.cashOutflow - res2.cashOutflow, delta);
        assert.equal(res1.economicCost - res2.economicCost, delta);
      }
    });

    it('스냅샷 의존 배제: 대수식과 원장 항목 합의 1원 단위 정확성 전수 검증', () => {
      const testInputs: ScenarioInput = {
        refundAmount: 77777,
        reverseShippingSellerCost: 4444,
        handlingCost: 1111,
        recoveredItemNetValue: 22222,
        feeReversalCredit: 3333,
        additionalSellerCost: 555,
      };

      const res = calculateReturnFull(testInputs);
      // 대수식: 77777 + 4444 + 1111 + 555 - 3333 = 80554
      assert.equal(res.cashOutflow, 80554);
      // 80554 - 22222 = 58332
      assert.equal(res.economicCost, 58332);
    });
  });
});
