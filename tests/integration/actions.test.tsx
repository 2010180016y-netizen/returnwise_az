import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  generateAnonymousSummaryReport,
  copyTextToClipboard,
} from '../../src/lib/clipboard';
import { Actions, CalculatorErrorBoundary } from '../../src/features/calculator/Actions';
import { ScenarioInput, DecisionFlags, ComparisonResult } from '../../src/domain/types';

describe('T17 | Actions, Clipboard & Recovery Integration Contract', () => {
  const sampleInputs: ScenarioInput = {
    refundAmount: 30000,
    reverseShippingSellerCost: 3500,
    handlingCost: 1000,
    recoveredItemNetValue: 9000,
  };

  const sampleFlags: DecisionFlags = {
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

  const sampleComparison: ComparisonResult = {
    metric: 'ECONOMIC_COST',
    eligibleCount: 2,
    totalAlternatives: 3,
    hasMultipleEligible: true,
    comparisonNotice: '순경제비용 기준 정렬',
    globalWarnings: [],
    refundGroup: [],
    exchangeGroup: [],
    bestAlternative: {
      alternative: 'RETURN_FULL',
      name: '표준 회수 후 전액환급',
      category: 'REFUND_GROUP',
      status: 'ELIGIBLE',
      rankingEligible: true,
      isRecommended: true,
      rank: 1,
      isTie: false,
      cashOutflow: 34500,
      economicCost: 25500,
      comparedMetricValue: 25500,
      deltaVsBest: 0,
      savingsIfChosen: 0,
      lineItems: [],
      assumptions: [],
      confidence: 'HIGH',
      reasons: [],
    },
    rankedList: [
      {
        alternative: 'RETURN_FULL',
        name: '표준 회수 후 전액환급',
        category: 'REFUND_GROUP',
        status: 'ELIGIBLE',
        rankingEligible: true,
        isRecommended: true,
        rank: 1,
        isTie: false,
        cashOutflow: 34500,
        economicCost: 25500,
        comparedMetricValue: 25500,
        deltaVsBest: 0,
        savingsIfChosen: 0,
        lineItems: [],
        assumptions: [],
        confidence: 'HIGH',
        reasons: [],
      },
      {
        alternative: 'KEEP_FULL',
        name: '회수 없는 전액환급',
        category: 'REFUND_GROUP',
        status: 'ELIGIBLE',
        rankingEligible: true,
        isRecommended: false,
        rank: 2,
        isTie: false,
        cashOutflow: 30000,
        economicCost: 30000,
        comparedMetricValue: 30000,
        deltaVsBest: 4500,
        savingsIfChosen: 0,
        lineItems: [],
        assumptions: [],
        confidence: 'HIGH',
        reasons: [],
      },
      {
        alternative: 'KEEP_PARTIAL',
        name: '합의 부분환급',
        category: 'REFUND_GROUP',
        status: 'INELIGIBLE',
        rankingEligible: false,
        isRecommended: false,
        rank: null,
        isTie: false,
        cashOutflow: 15000,
        economicCost: 15000,
        comparedMetricValue: 15000,
        deltaVsBest: null,
        savingsIfChosen: null,
        lineItems: [],
        assumptions: [],
        confidence: 'LOW',
        reasons: ['소비자 합의 필요 (L03)'],
      },
    ],
  };

  describe('1. 익명 요약 리포트 생성 및 안전 조건 (No PII)', () => {
    it('클립보드 리포트에 실 구매자 개인정보(주문번호, 고객명, 연락처, 배송지)가 일체 포함되지 않아야 한다', () => {
      const report = generateAnonymousSummaryReport({
        inputs: sampleInputs,
        flags: sampleFlags,
        comparison: sampleComparison,
      });

      // Assert structure
      assert.ok(report.includes('[ReturnWise] 반품·교환 의사결정 요약 리포트'));
      assert.ok(report.includes('네이버 스마트스토어'));
      assert.ok(report.includes('대안 1: 표준 회수 후 전액환급 [최저비용 1위]'));
      assert.ok(report.includes('25,500원'));
      assert.ok(report.includes('34,500원'));

      // STRICT SAFETY CONDITION: No customer PII
      assert.equal(report.includes('주문번호'), false);
      assert.equal(report.includes('구매자명'), false);
      assert.equal(report.includes('고객명'), false);
      assert.equal(report.includes('전화번호'), false);
      assert.equal(report.includes('배송지'), false);
      assert.equal(report.includes('010-'), false);
    });

    it('추천 제외 대안의 경우 제외 사유가 리포트에 정직하게 명시되어야 한다', () => {
      const report = generateAnonymousSummaryReport({
        inputs: sampleInputs,
        flags: sampleFlags,
        comparison: sampleComparison,
      });

      assert.ok(report.includes('[추천 제외]'));
      assert.ok(report.includes('소비자 합의 필요 (L03)'));
    });
  });

  describe('2. 클립보드 복사 성공 및 권한 거절 fallback 검증', () => {
    it('Navigator Clipboard API가 성공적으로 동작하면 clipboard-api 결과를 반환해야 한다', async () => {
      let writtenText = '';
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          clipboard: {
            writeText: async (t: string) => {
              writtenText = t;
            },
          },
        },
        configurable: true,
        writable: true,
      });

      const res = await copyTextToClipboard('테스트 리포트 내용');
      assert.equal(res.success, true);
      assert.equal(res.method, 'clipboard-api');
      assert.equal(writtenText, '테스트 리포트 내용');
    });

    it('Clipboard API가 거부되거나 예외를 던질 때 legacy execCommand 또는 fallback-modal로 안전 복구해야 한다', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          clipboard: {
            writeText: async () => {
              throw new Error('NotAllowedError: Read/write permission denied.');
            },
          },
        },
        configurable: true,
        writable: true,
      });

      // In Node server environment without document, falls back to fallback-modal
      const res = await copyTextToClipboard('폴백 테스트 내용');
      assert.equal(res.success, false);
      assert.equal(res.method, 'fallback-modal');
      assert.ok(res.error.length > 0);
    });
  });

  describe('3. URL / 쿠키 / 분석 페이로드 노출 금지 계약', () => {
    it('계산 결과나 입력 수치가 document.cookie 또는 window.location.search에 유출되지 않아야 한다', () => {
      const mockDocument = { cookie: '' };
      const mockWindow = { location: { search: '' } };

      (global as unknown as { document: typeof mockDocument; window: typeof mockWindow }).document = mockDocument;
      (global as unknown as { document: typeof mockDocument; window: typeof mockWindow }).window = mockWindow;

      // Render Actions component
      const html = renderToStaticMarkup(
        <Actions
          inputs={sampleInputs}
          flags={sampleFlags}
          comparison={sampleComparison}
          onLoadExampleC01={() => {}}
          onLoadExampleC03={() => {}}
          onResetAll={() => {}}
        />
      );

      assert.ok(html.includes('익명 요약 리포트 복사'));
      assert.ok(html.includes('전체 초기화'));

      // Check cookie & search strings remain completely clean
      assert.equal(mockDocument.cookie, '');
      assert.equal(mockWindow.location.search, '');
      assert.equal(mockDocument.cookie.includes('refundAmount'), false);
      assert.equal(mockWindow.location.search.includes('economicCost'), false);
    });
  });

  describe('4. ErrorBoundary 렌더링 및 비정상 복구 검증', () => {
    it('정상적인 컴포넌트는 자식 요소를 정상 렌더링해야 한다', () => {
      const html = renderToStaticMarkup(
        <CalculatorErrorBoundary>
          <div data-testid="child-content">정상 계산기 내용</div>
        </CalculatorErrorBoundary>
      );

      assert.ok(html.includes('정상 계산기 내용'));
    });

    it('에러 발생 시 ErrorBoundary가 안전 복구 배너와 재시도 버튼을 렌더링해야 한다', () => {
      const derivedState = CalculatorErrorBoundary.getDerivedStateFromError(
        new Error('Unexpected calculation crash')
      );
      assert.equal(derivedState.hasError, true);
      assert.equal(derivedState.error?.message, 'Unexpected calculation crash');

      // Test recover handler
      let resetCalled = false;
      const instance = new CalculatorErrorBoundary({
        children: null,
        onReset: () => {
          resetCalled = true;
        },
      });
      instance.state = { hasError: true, error: new Error('Crash') };
      instance.handleRecover();
      assert.equal(instance.state.hasError, false);
      assert.equal(resetCalled, true);
    });
  });
});
