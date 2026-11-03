import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalculatorPage } from '../../src/features/calculator/CalculatorPage';
import { App } from '../../src/app/App';

describe('T12 | Calculator Single Page Layout & State Flow', () => {
  describe('1. CalculatorPage 렌더링 및 정보 구조 검증', () => {
    it('헤더, 네비게이션 앵커 링크 4종이 올바르게 포함되어야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(CalculatorPage));
      assert.equal(html.includes('ReturnWise'), true);
      assert.equal(html.includes('href="#step-context"'), true);
      assert.equal(html.includes('href="#step-inputs"'), true);
      assert.equal(html.includes('href="#step-results"'), true);
      assert.equal(html.includes('href="#faq"'), true);
    });

    it('히어로 섹션 및 1클릭 예시 불러오기 버튼이 존재해야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(CalculatorPage));
      assert.equal(html.includes('반품 한 건, 실제로 얼마가 더 들까요?'), true);
      assert.equal(html.includes('표준 반품(C01) 불러오기'), true);
      assert.equal(html.includes('부분환불 합의(C03) 불러오기'), true);
      assert.equal(html.includes('전체 초기화'), true);
    });

    it('STEP 1(상황·권리 확인)과 법률 게이트 체크박스가 존재해야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(CalculatorPage));
      assert.equal(html.includes('STEP 1'), true);
      assert.equal(html.includes('상황 및 권리 확인'), true);
      assert.equal(html.includes('반품 귀책 사유'), true);
      assert.equal(html.includes('소비자 단순변심'), true);
      assert.equal(html.includes('필수 권리 및 법률 게이트 점검'), true);
    });

    it('STEP 2(비용 입력)와 주요 원 단위 필드가 존재해야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(CalculatorPage));
      assert.equal(html.includes('STEP 2'), true);
      assert.equal(html.includes('비용 및 금액 입력'), true);
      assert.equal(html.includes('환급 예정 금액'), true);
      assert.equal(html.includes('판매자 부담 회수 운송비'), true);
      assert.equal(html.includes('회수 상품의 보수적 순가치'), true);
    });

    it('STEP 3(대안 비교 결과)과 4대 대안 카드가 존재해야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(CalculatorPage));
      assert.equal(html.includes('STEP 3'), true);
      assert.equal(html.includes('대안 비교 결과'), true);
      assert.equal(html.includes('순경제비용 기준 (추천)'), true);
      assert.equal(html.includes('현금 지출 기준'), true);
      assert.equal(html.includes('회수 후 전액환급'), true);
      assert.equal(html.includes('회수 없는 전액환급'), true);
      assert.equal(html.includes('합의된 부분환급'), true);
      assert.equal(html.includes('1:1 맞교환 처리'), true);
    });

    it('FAQ 섹션 및 법률 유의사항 4문항이 포함되어야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(CalculatorPage));
      assert.equal(html.includes('자주 묻는 질문'), true);
      assert.equal(html.includes('순경제비용'), true);
      assert.equal(html.includes('전자상거래법 제17조'), true);
      assert.equal(html.includes('전자상거래법 제18조'), true);
    });

    it('푸터 면책 고지 및 100% 브라우저 로컬 연산 안내가 포함되어야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(CalculatorPage));
      assert.equal(html.includes('2026.7.21 시행'), true);
      assert.equal(html.includes('개인정보 및 주문 식별값 수집 제로 (No PII)'), true);
    });
  });

  describe('2. App 루트 래퍼 정상 렌더링', () => {
    it('App 컴포넌트 렌더링 시 rw-container와 CalculatorPage가 래핑되어야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(App));
      assert.equal(html.includes('rw-container'), true);
      assert.equal(html.includes('ReturnWise'), true);
    });
  });
});
