import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Breakdown } from '../../src/features/calculator/Breakdown';
import { compareAlternatives } from '../../src/domain/compare';
import {
  GLOSSARY_ITEMS,
  LEGAL_SOURCES,
  generateCopyableFormulaText,
} from '../../src/content/glossary';

describe('T15 | Breakdown & Glossary Contract Tests', () => {
  // C01 standard comparison result
  const comparison = compareAlternatives(
    {
      refundAmount: 30000,
      reverseShippingSellerCost: 3500,
      handlingCost: 1000,
      recoveredItemNetValue: 9000,
      feeReversalCredit: 0,
      initialProcurementCost: 20000, // Common sunk cost
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
    'ECONOMIC_COST'
  );

  const returnFullAlt = comparison.rankedList.find((a) => a.alternative === 'RETURN_FULL')!;

  describe('1. 용어사전(glossary.ts) 무결성 및 안전 가드레일', () => {
    it('용어사전에 cash-outflow, economic-cost 등 핵심 재무·법률 항목 6종이 정의되어 있어야 한다', () => {
      assert.equal(GLOSSARY_ITEMS.length >= 6, true);
      const ids = GLOSSARY_ITEMS.map((g) => g.id);
      assert.equal(ids.includes('cash-outflow'), true);
      assert.equal(ids.includes('economic-cost'), true);
      assert.equal(ids.includes('recovered-item-net-value'), true);
      assert.equal(ids.includes('fee-reversal-credit'), true);
      assert.equal(ids.includes('initial-procurement-cost'), true);
      assert.equal(ids.includes('voluntary-agreement'), true);
    });

    it('2026 전자상거래법 출처 3종(제17조, 제18조 제9항, 제35조)이 등록되어 있어야 한다', () => {
      assert.equal(LEGAL_SOURCES.length >= 3, true);
      const articles = LEGAL_SOURCES.map((l) => l.article);
      assert.equal(articles.some((a) => a.includes('제17조')), true);
      assert.equal(articles.some((a) => a.includes('제18조 제9항')), true);
      assert.equal(articles.some((a) => a.includes('제35조')), true);
    });

    it('용어사전과 법률 출처에서 회수가치를 "매출"이나 "순이익"으로 설명하지 않아야 한다 (안전조건)', () => {
      const glossaryText = JSON.stringify(GLOSSARY_ITEMS);
      assert.equal(glossaryText.includes('매출이나 순이익으로 인식해서는 안 되며'), true);
      assert.equal(glossaryText.includes('매출로 환산'), false);
      assert.equal(glossaryText.includes('순이익이 발생'), false);
    });
  });

  describe('2. Breakdown 컴포넌트 수식 unfold 및 합계 일치 검증', () => {
    it('대수 수식 분해 블록에 현금 지출과 순경제비용 계산 과정이 unfold되어야 한다', () => {
      const html = renderToStaticMarkup(
        React.createElement(Breakdown, {
          alternative: returnFullAlt,
          onClose: () => {},
        })
      );

      assert.equal(html.includes('대수 수식 분해 (Unfolded Formulas)'), true);
      assert.equal(html.includes('[추가 현금 지출 공식]'), true);
      assert.equal(html.includes('[순경제적 비용(실질 손실) 공식]'), true);
      // 수식 내 34,500원 및 25,500원 확인
      assert.equal(html.includes('34,500원'), true);
      assert.equal(html.includes('25,500원'), true);
    });

    it('원장 세부 합계와 상단 표시 숫자가 1원의 오차도 없이 일치해야 한다', () => {
      const cashSum = returnFullAlt.lineItems
        .filter((item) => item.type === 'CASH_OUTFLOW')
        .reduce((sum, item) => sum + item.amount, 0);
      const creditSum = returnFullAlt.lineItems
        .filter((item) => item.type === 'CREDIT')
        .reduce((sum, item) => sum + item.amount, 0);
      const assetSum = returnFullAlt.lineItems
        .filter((item) => item.type === 'ASSET_VALUE')
        .reduce((sum, item) => sum + item.amount, 0);

      assert.equal(cashSum - creditSum, returnFullAlt.cashOutflow);
      assert.equal(cashSum - creditSum - assetSum, returnFullAlt.economicCost);
    });
  });

  describe('3. 한계 고지 및 출처 링크 렌더링 검증', () => {
    it('회계·비용 한계 및 전자상거래법 출처 링크가 모두 렌더링되어야 한다', () => {
      const html = renderToStaticMarkup(
        React.createElement(Breakdown, {
          alternative: returnFullAlt,
          onClose: () => {},
        })
      );

      assert.equal(html.includes('회계 및 비용 산정 한계 고지'), true);
      assert.equal(html.includes('회수 순가치 평가 기준:'), true);
      assert.equal(html.includes('플랫폼 수수료 환급:'), true);
      assert.equal(html.includes('공통 매몰원가 제외:'), true);
      assert.equal(html.includes('2026 전자상거래법 출처 및 규정 확인'), true);
      assert.equal(html.includes('제18조 제9항'), true);
    });
  });

  describe('4. 산식 텍스트 복사 생성기 검증', () => {
    it('generateCopyableFormulaText가 사내 공유 가능한 정형 텍스트를 생성해야 한다', () => {
      const copyText = generateCopyableFormulaText(returnFullAlt);

      assert.equal(copyText.includes('[ReturnWise 반품 비용 산식 리포트]'), true);
      assert.equal(copyText.includes('대안 방식: 회수 후 전액환급'), true);
      assert.equal(copyText.includes('추가 현금 지출 (통장 유출액): 34,500원'), true);
      assert.equal(copyText.includes('순경제적 손실 (자산가치 반영): 25,500원'), true);
      assert.equal(copyText.includes('원장 세부 항목 분해 (1원 단위)'), true);
      assert.equal(copyText.includes('구매자 환급액: 30,000원'), true);
      assert.equal(copyText.includes('회수 상품 순가치'), true);
      assert.equal(copyText.includes('[중요] 회수 상품 가치는 보수적 재고 평가액이며, 매출이나 순이익이 아닙니다.'), true);
    });
  });
});
