import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResultView, ResultViewProps } from '../../src/features/calculator/ResultView';
import { compareAlternatives } from '../../src/domain/compare';

describe('T14 | ResultView Integration & Visualization Contract', () => {
  // C01 standard scenario (partial refund NOT agreed)
  const c01Comparison = compareAlternatives(
    {
      refundAmount: 30000,
      reverseShippingSellerCost: 3500,
      handlingCost: 1000,
      recoveredItemNetValue: 9000,
      feeReversalCredit: 0,
      agreedPartialRefund: 15000,
      replacementCost: 12000,
      replacementOutboundShipping: 3000,
    },
    {
      reason: 'BUYER_REMORSE',
      buyerRequest: 'REFUND',
      platform: 'NAVER',
      policyReviewed: true,
      rightsReviewed: true,
      voluntaryAgreementConfirmed: false, // NOT agreed!
      permittedByPolicyConfirmed: true,
      rightsNotRestrictedConfirmed: true,
      buyerAgreedExchange: false,
      isSpecialItem: false,
      isPolicyOutdated: false,
    },
    'ECONOMIC_COST'
  );

  const defaultProps: ResultViewProps = {
    comparisonResult: c01Comparison,
    metric: 'ECONOMIC_COST',
    onSelectMetric: () => {},
    expandedBreakdown: null,
    onToggleBreakdown: () => {},
  };

  describe('1. 4대 대안 카드 및 수치 막대 시각화 검증', () => {
    it('순경제비용 탭에서 C01(25,500원)이 1위 추천으로 하이라이트되어야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(ResultView, defaultProps));

      // 1위 추천 배지 확인
      assert.equal(html.includes('최저비용 추천 (1위)'), true);
      // C01 순경제비용 25,500원 확인
      assert.equal(html.includes('25,500원'), true);
      // 막대 차트 확인
      assert.equal(html.includes('role="progressbar"'), true);
      assert.equal(html.includes('대안별 상대 비용 비교 막대'), true);
    });

    it('현금 지출 기준 탭 전환 시 현금 지출 수치와 보조 지표가 올바르게 표시되어야 한다', () => {
      const cashComparison = compareAlternatives(
        {
          refundAmount: 30000,
          reverseShippingSellerCost: 3500,
          handlingCost: 1000,
          recoveredItemNetValue: 9000,
        },
        {
          reason: 'BUYER_REMORSE',
          buyerRequest: 'REFUND',
          platform: 'NAVER',
          policyReviewed: true,
          rightsReviewed: true,
          voluntaryAgreementConfirmed: false,
          permittedByPolicyConfirmed: true,
          rightsNotRestrictedConfirmed: true,
          buyerAgreedExchange: false,
        },
        'CASH_OUTFLOW'
      );

      const props: ResultViewProps = {
        ...defaultProps,
        comparisonResult: cashComparison,
        metric: 'CASH_OUTFLOW',
      };

      const html = renderToStaticMarkup(React.createElement(ResultView, props));

      // 현금 지출 탭 버튼이 선택됨
      assert.equal(html.includes('aria-selected="true"'), true);
      // KEEP_FULL(30,000원)이 현금 기준 1위
      assert.equal(html.includes('30,000원'), true);
    });
  });

  describe('2. 현금 지출 vs 순경제비용 동시 비교 요약 표 (C01 vs C02) 검증', () => {
    it('요약 대조표에 C01(34,500 / 25,500)과 C02(30,000 / 30,000)이 동시에 정확히 표시되어야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(ResultView, defaultProps));

      assert.equal(html.includes('4대 처리 방식 지표 대조표'), true);
      assert.equal(html.includes('현금 추가지출 (원)'), true);
      assert.equal(html.includes('순경제적 비용 (원)'), true);

      // C01 수치
      assert.equal(html.includes('34,500원'), true);
      assert.equal(html.includes('25,500원'), true);

      // C02 수치
      assert.equal(html.includes('30,000원'), true);
    });
  });

  describe('3. 비허용 대안 안전 가드레일 검증 (L03/L04/L05/L06)', () => {
    it('소비자 합의가 없는 부분환불은 "추천 제외" 배지를 받고 추천 1위가 될 수 없다', () => {
      const html = renderToStaticMarkup(React.createElement(ResultView, defaultProps));

      // 부분환불 대안 찾기
      const partialAlt = c01Comparison.rankedList.find((a) => a.alternative === 'KEEP_PARTIAL');
      assert.equal(partialAlt?.status, 'INELIGIBLE');
      assert.equal(partialAlt?.isRecommended, false);

      // HTML 내에 추천 제외 표기 확인
      assert.equal(html.includes('추천 제외'), true);
      assert.equal(html.includes('소비자의 자발적 합의가 확인되지 않았습니다') || html.includes('L03'), true);
    });
  });

  describe('4. 상세 산식 1원 단위 분해 렌더링 검증', () => {
    it('대안 산식 토글 시 ResultTable과 적용 가정이 렌더링되어야 한다', () => {
      const props: ResultViewProps = {
        ...defaultProps,
        expandedBreakdown: 'RETURN_FULL',
      };

      const html = renderToStaticMarkup(React.createElement(ResultView, props));

      assert.equal(html.includes('1원 단위 산식 분해: 회수 후 전액환급'), true);
      assert.equal(html.includes('적용된 주요 가정:'), true);
      assert.equal(html.includes('rw-table'), true);
    });
  });

  describe('5. 특별 안전조건 검증 (오인 문구 금지)', () => {
    it('"수익" 또는 "확정절감"과 같이 고객을 기만하거나 오인시킬 수 있는 문구가 일체 없어야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(ResultView, defaultProps));

      assert.equal(html.includes('수익'), false);
      assert.equal(html.includes('확정절감'), false);
      assert.equal(html.includes('확정 절감'), false);
    });
  });
});
