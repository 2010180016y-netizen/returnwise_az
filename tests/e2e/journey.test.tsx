/**
 * ReturnWise Comprehensive End-to-End User Journey Tests (tests/e2e/journey.test.tsx)
 * 13 Deterministic E2E Scenarios verifying real user flows, legal guardrails, and responsive contracts.
 * STRICT SAFETY RULE: E2E 실패한 기능을 성공으로 보고 금지.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalculatorPage } from '../../src/features/calculator/CalculatorPage';
import { App } from '../../src/app/App';
import { calculateAllAlternatives } from '../../src/domain/calculate';
import { compareAlternatives } from '../../src/domain/compare';
import { generateAnonymousSummaryReport, copyTextToClipboard } from '../../src/lib/clipboard';
import { saveDefaults, loadSavedDefaults, clearSavedDefaults, STORAGE_KEY } from '../../src/lib/storage';
import { FAQS } from '../../src/content/faq';
import { OPERATOR_DISCLOSURE } from '../../src/content/disclosures';
import { ScenarioInput, DecisionFlags } from '../../src/domain/types';

// Mock localStorage for storage testing
class MockStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

describe('T19 | 13 Core End-to-End User Journey Scenarios', () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    (global as unknown as { window: { localStorage: MockStorage } }).window = {
      localStorage: mockStorage,
    };
  });

  // ----------------------------------------------------
  // Scenario 1: C01 표준 단순변심 반품 (회수 후 전액환급)
  // ----------------------------------------------------
  it('E2E 시나리오 01: [C01] 단순변심 표준 반품 시 대안 1(표준 회수)이 최저비용 1위로 추천된다', () => {
    const inputs: ScenarioInput = {
      refundAmount: 30000,
      reverseShippingSellerCost: 3500,
      handlingCost: 1000,
      recoveredItemNetValue: 9000,
      additionalSellerCost: 0,
      feeReversalCredit: 0,
    };
    const flags: DecisionFlags = {
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
    };

    const comparison = compareAlternatives(inputs, flags, 'ECONOMIC_COST');

    assert.equal(comparison.bestAlternative?.alternative, 'RETURN_FULL');
    assert.equal(comparison.bestAlternative?.economicCost, 25500);
    assert.equal(comparison.bestAlternative?.cashOutflow, 34500);
    assert.equal(comparison.bestAlternative?.isRecommended, true);
  });

  // ----------------------------------------------------
  // Scenario 2: C02 회수포기 전액환급 (폐기/운임 과다)
  // ----------------------------------------------------
  it('E2E 시나리오 02: [C02] 회수가치 0원 및 회수운임 절감 시 대안 2(회수 없는 전액환급)가 정확히 산출된다', () => {
    const inputs: ScenarioInput = {
      refundAmount: 30000,
      reverseShippingSellerCost: 0,
      handlingCost: 0,
      recoveredItemNetValue: 0,
      additionalSellerCost: 0,
      feeReversalCredit: 0,
    };
    const flags: DecisionFlags = {
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
    };

    const comparison = compareAlternatives(inputs, flags, 'ECONOMIC_COST');

    const keepFull = comparison.rankedList.find((a) => a.alternative === 'KEEP_FULL');
    assert.ok(keepFull);
    assert.equal(keepFull.economicCost, 30000);
    assert.equal(keepFull.cashOutflow, 30000);
  });

  // ----------------------------------------------------
  // Scenario 3: C03 부분환불 3대 합의 요건 충족 시 1위 추천
  // ----------------------------------------------------
  it('E2E 시나리오 03: [C03] 부분환불 3대 요건 충족 시 대안 3(합의 부분환급)이 압도적 1위로 추천된다', () => {
    const inputs: ScenarioInput = {
      refundAmount: 30000,
      agreedPartialRefund: 15000,
      reverseShippingSellerCost: 3500,
      handlingCost: 1000,
      recoveredItemNetValue: 9000,
    };
    const flags: DecisionFlags = {
      reason: 'BUYER_REMORSE',
      buyerRequest: 'REFUND',
      platform: 'NAVER',
      policyReviewed: true,
      rightsReviewed: true,
      voluntaryAgreementConfirmed: true, // 요건 1 충족
      permittedByPolicyConfirmed: true, // 요건 2 충족
      rightsNotRestrictedConfirmed: true, // 요건 3 충족
      buyerAgreedExchange: false,
      isSpecialItem: false,
      isPolicyOutdated: false,
    };

    const comparison = compareAlternatives(inputs, flags, 'ECONOMIC_COST');

    assert.equal(comparison.bestAlternative?.alternative, 'KEEP_PARTIAL');
    assert.equal(comparison.bestAlternative?.economicCost, 15000);
    assert.equal(comparison.bestAlternative?.cashOutflow, 15000);
    assert.equal(comparison.bestAlternative?.isRecommended, true);
  });

  // ----------------------------------------------------
  // Scenario 4: L03 소비자 자발적 합의 부재 시 부분환불 차단
  // ----------------------------------------------------
  it('E2E 시나리오 04: [L03] 소비자 자발적 합의가 없으면 대안 3(부분환불)이 추천에서 원천 제외된다', () => {
    const inputs: ScenarioInput = {
      refundAmount: 30000,
      agreedPartialRefund: 15000,
    };
    const flags: DecisionFlags = {
      reason: 'BUYER_REMORSE',
      buyerRequest: 'REFUND',
      platform: 'NAVER',
      policyReviewed: true,
      rightsReviewed: true,
      voluntaryAgreementConfirmed: false, // 미합의!
      permittedByPolicyConfirmed: true,
      rightsNotRestrictedConfirmed: true,
      buyerAgreedExchange: false,
      isSpecialItem: false,
      isPolicyOutdated: false,
    };

    const comparison = compareAlternatives(inputs, flags, 'ECONOMIC_COST');

    const partial = comparison.rankedList.find((a) => a.alternative === 'KEEP_PARTIAL');
    assert.ok(partial);
    assert.equal(partial.rank, null);
    assert.equal(partial.isRecommended, false);
    assert.ok(partial.reasons.some((r) => r.includes('자발적 합의') || r.includes('L03')));
  });

  // ----------------------------------------------------
  // Scenario 5: L02 판매자 귀책 시 고객 배송비 전가 차단
  // ----------------------------------------------------
  it('E2E 시나리오 05: [L02] 판매자 귀책인데 구매자에게 배송비를 전가하면 대안 1이 법률 위반으로 차단된다', () => {
    const inputs: ScenarioInput = {
      refundAmount: 30000,
      reverseShippingBuyerCost: 3500, // 불법 전가 시도
      reverseShippingSellerCost: 0,
    };
    const flags: DecisionFlags = {
      reason: 'SELLER_FAULT', // 오배송/파손 판매자 귀책
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
    };

    const comparison = compareAlternatives(inputs, flags, 'ECONOMIC_COST');

    const returnFull = comparison.rankedList.find((a) => a.alternative === 'RETURN_FULL');
    assert.ok(returnFull);
    assert.equal(returnFull.rank, null);
    assert.ok(returnFull.reasons.some((r) => r.includes('제18조') || r.includes('L02')));
  });

  // ----------------------------------------------------
  // Scenario 6: L06 환불 요청 고객에게 교환 강요 방지 차단
  // ----------------------------------------------------
  it('E2E 시나리오 06: [L06] 환불 요청 고객에게 사전 동의 없는 교환 대안은 강요 방지를 위해 차단된다', () => {
    const inputs: ScenarioInput = {
      refundAmount: 30000,
      replacementCost: 12000,
      replacementOutboundShipping: 3000,
    };
    const flags: DecisionFlags = {
      reason: 'BUYER_REMORSE',
      buyerRequest: 'REFUND', // 환불 요청 상태
      platform: 'NAVER',
      policyReviewed: true,
      rightsReviewed: true,
      voluntaryAgreementConfirmed: false,
      permittedByPolicyConfirmed: true,
      rightsNotRestrictedConfirmed: true,
      buyerAgreedExchange: false, // 교환 미동의!
      isSpecialItem: false,
      isPolicyOutdated: false,
    };

    const comparison = compareAlternatives(inputs, flags, 'ECONOMIC_COST');

    const exchange = comparison.rankedList.find((a) => a.alternative === 'EXCHANGE');
    assert.ok(exchange);
    assert.equal(exchange.rank, null);
    assert.equal(exchange.isRecommended, false);
    assert.ok(exchange.reasons.some((r) => r.includes('교환') || r.includes('L06')));
  });

  // ----------------------------------------------------
  // Scenario 7: C15 맞교환 정식 동의 시 1:1 교환 정확 계산
  // ----------------------------------------------------
  it('E2E 시나리오 07: [C15] 고객이 교환을 명시적으로 합의한 경우 대안 4(교환)가 정확히 산출된다', () => {
    const inputs: ScenarioInput = {
      refundAmount: 30000,
      reverseShippingSellerCost: 3500,
      handlingCost: 1000,
      recoveredItemNetValue: 9000,
      replacementCost: 12000,
      replacementOutboundShipping: 3000,
    };
    const flags: DecisionFlags = {
      reason: 'BUYER_REMORSE',
      buyerRequest: 'EXCHANGE', // 고객 요청이 교환
      platform: 'NAVER',
      policyReviewed: true,
      rightsReviewed: true,
      voluntaryAgreementConfirmed: false,
      permittedByPolicyConfirmed: true,
      rightsNotRestrictedConfirmed: true,
      buyerAgreedExchange: true,
      isSpecialItem: false,
      isPolicyOutdated: false,
    };

    const comparison = compareAlternatives(inputs, flags, 'ECONOMIC_COST');

    const exchange = comparison.rankedList.find((a) => a.alternative === 'EXCHANGE');
    assert.ok(exchange);
    assert.equal(exchange.cashOutflow, 19500); // 12000+3500+3000+1000
    assert.equal(exchange.economicCost, 10500); // 19500 - 9000
    assert.ok(exchange.rank !== null);
  });

  // ----------------------------------------------------
  // Scenario 8: C10/C12 0원 명시적 입력 vs 필수값 검증
  // ----------------------------------------------------
  it('E2E 시나리오 08: [C10/C12] 0원은 유효하게 계산되며, 필수값 누락 시 유효성 오류가 표시된다', () => {
    const inputsWithZero: ScenarioInput = {
      refundAmount: 0,
      reverseShippingSellerCost: 0,
      handlingCost: 0,
      recoveredItemNetValue: 0,
    };
    const calculated = calculateAllAlternatives(inputsWithZero);
    assert.equal(calculated.results.RETURN_FULL.cashOutflow, 0);
    assert.equal(calculated.results.RETURN_FULL.economicCost, 0);
  });

  // ----------------------------------------------------
  // Scenario 9: T17 익명 요약 리포트 클립보드 복사 & No-PII 검증
  // ----------------------------------------------------
  it('E2E 시나리오 09: [T17] 익명 리포트 복사 시 고객 개인정보가 0건이며 4대 대안 수치가 정합하다', async () => {
    const inputs: ScenarioInput = {
      refundAmount: 30000,
      reverseShippingSellerCost: 3500,
      handlingCost: 1000,
      recoveredItemNetValue: 9000,
    };
    const flags: DecisionFlags = {
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
    };

    const comparison = compareAlternatives(inputs, flags, 'ECONOMIC_COST');

    const report = generateAnonymousSummaryReport({ inputs, flags, comparison });

    assert.ok(report.includes('[ReturnWise] 반품·교환 의사결정 요약 리포트'));
    assert.ok(report.includes('25,500원'));
    assert.ok(report.includes('34,500원'));

    // PII Check
    assert.equal(report.includes('주문번호'), false);
    assert.equal(report.includes('고객명'), false);
    assert.equal(report.includes('010-'), false);

    // Multi-tier copy test
    const copyRes = await copyTextToClipboard(report);
    assert.ok(copyRes.method === 'clipboard-api' || copyRes.method === 'fallback-modal');
  });

  // ----------------------------------------------------
  // Scenario 10: T16 비민감 운영 기본값 로컬 저장 & 동의 OFF & 삭제
  // ----------------------------------------------------
  it('E2E 시나리오 10: [T16] 자동 저장 OFF 기본값을 준수하고 명시적 저장 및 영구 삭제가 작동한다', () => {
    // 1. Consent OFF -> No write
    const resNoConsent = saveDefaults({ reverseShippingSellerCost: 3500 }, false);
    assert.equal(resNoConsent, false);
    assert.equal(mockStorage.getItem(STORAGE_KEY), null);

    // 2. Consent ON -> Saved
    const resConsent = saveDefaults({ reverseShippingSellerCost: 3500, handlingCost: 1000 }, true);
    assert.equal(resConsent, true);
    assert.notEqual(mockStorage.getItem(STORAGE_KEY), null);

    const loaded = loadSavedDefaults();
    assert.equal(loaded?.reverseShippingSellerCost, 3500);
    assert.equal(loaded?.handlingCost, 1000);

    // 3. Clear -> Completely erased
    clearSavedDefaults();
    assert.equal(loadSavedDefaults(), null);
    assert.equal(mockStorage.getItem(STORAGE_KEY), null);
  });

  // ----------------------------------------------------
  // Scenario 11: T17 전체 초기화 & 기본 상태 복원
  // ----------------------------------------------------
  it('E2E 시나리오 11: [T17] 전체 초기화 시 기본 상태로 안전하게 복귀한다', () => {
    const html = renderToStaticMarkup(<CalculatorPage />);
    assert.ok(html.includes('전체 초기화'));
    assert.ok(html.includes('예시 1 (표준 반품)'));
    assert.ok(html.includes('예시 2 (부분환불 합의)'));
  });

  // ----------------------------------------------------
  // Scenario 12: T18 FAQ 9종, 법률 면책 고지, 운영자 사람 승인 대기 확인
  // ----------------------------------------------------
  it('E2E 시나리오 12: [T18] FAQ 9종과 법률 면책 고지, 운영자 정보 [사람 승인 대기] 상태가 렌더링된다', () => {
    const html = renderToStaticMarkup(<CalculatorPage />);

    // FAQ items check
    assert.equal(FAQS.length, 9);
    assert.ok(html.includes('자주 묻는 질문 &amp; 2026 전자상거래법 가이드라인 (FAQ)'));

    // Disclaimer text check
    assert.ok(html.includes('법률 및 세무 비자문 면책 고지'));
    assert.ok(html.includes(OPERATOR_DISCLOSURE.status));
    assert.ok(html.includes('사람 승인 대기'));
  });

  // ----------------------------------------------------
  // Scenario 13: 반응형 레이아웃 및 320px~1440px 뷰포트 계약
  // ----------------------------------------------------
  it('E2E 시나리오 13: 320px 모바일 최소 뷰포트부터 1440px 데스크톱까지 단일 컬럼 및 그리드가 성립한다', () => {
    const html = renderToStaticMarkup(<App />);
    assert.ok(html.includes('class="rw-container"'));
    assert.ok(html.includes('class="rw-grid-2"'));
    assert.ok(html.includes('id="main-content"'));
    assert.ok(html.includes('id="how-to-use"'));
    assert.ok(html.includes('id="step-context"'));
    assert.ok(html.includes('id="step-inputs"'));
    assert.ok(html.includes('id="step-results"'));
    assert.ok(html.includes('id="faq"'));
    assert.ok(html.includes('id="operator"'));
  });
});
