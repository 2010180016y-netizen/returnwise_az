import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InputForm, InputFormProps } from '../../src/features/calculator/InputForm';

describe('T13 | InputForm Integration & Safety Contract', () => {
  const defaultProps: InputFormProps = {
    rawInputs: {
      refundAmount: '30,000',
      reverseShippingSellerCost: '3,500',
      reverseShippingBuyerCost: '0',
      handlingCost: '1,000',
      recoveredItemNetValue: '9,000',
      feeReversalCredit: '0',
      additionalSellerCost: '0',
      agreedPartialRefund: '15,000',
      replacementCost: '12,000',
      replacementOutboundShipping: '3,000',
    },
    flags: {
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
    },
    inputErrors: {},
    onUpdateInput: () => {},
    onUpdateFlag: () => {},
    onLoadExampleC01: () => {},
    onLoadExampleC03: () => {},
    onResetAll: () => {},
  };

  describe('1. 폼 구조 및 필수/선택 필드 렌더링 검증', () => {
    it('필수 환급 예정 금액과 선택 필드가 명확히 구분되어 렌더링되어야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(InputForm, defaultProps));

      // 환급 예정 금액 (필수)
      assert.equal(html.includes('환급 예정 금액'), true);
      assert.equal(html.includes('field-refund-amount'), true);
      assert.equal(html.includes('aria-required="true"'), true);

      // 판매자 부담 회수 운송비
      assert.equal(html.includes('판매자 부담 회수 운송비'), true);
      assert.equal(html.includes('field-reverse-shipping-seller'), true);

      // 선택 항목들
      assert.equal(html.includes('처리·검수·재포장비 (선택)'), true);
      assert.equal(html.includes('회수 상품의 보수적 순가치 (선택)'), true);
      assert.equal(html.includes('확정 수수료 환급액 (선택)'), true);
      assert.equal(html.includes('소비자 합의된 부분환급액 (선택)'), true);
      assert.equal(html.includes('교환용 새 상품 사입원가 (선택)'), true);
      assert.equal(html.includes('교환 상품 출고 배송비 (선택)'), true);
    });

    it('KRW 금액 단위(원)와 한글 읽기 도움말이 정상 표시되어야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(InputForm, defaultProps));
      // 원 단위 suffix 확인
      assert.equal(html.includes('rw-input-suffix'), true);
      assert.equal(html.includes('원'), true);
      // 30,000원 -> "3만 원" 한글 읽기 도움말
      assert.equal(html.includes('3만 원'), true);
    });

    it('0원 명시 입력 시 "0원 (명시적 0원 입력)" 도움말이 표시되어야 한다', () => {
      const props: InputFormProps = {
        ...defaultProps,
        rawInputs: {
          ...defaultProps.rawInputs,
          feeReversalCredit: '0',
        },
      };
      const html = renderToStaticMarkup(React.createElement(InputForm, props));
      assert.equal(html.includes('0원 (명시적 0원 입력)'), true);
    });
  });

  describe('2. 반품 사유 및 법률 게이트 컨트롤 검증', () => {
    it('귀책 사유, 고객 요청, 플랫폼 선택 셀렉트가 올바른 옵션을 포함해야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(InputForm, defaultProps));

      assert.equal(html.includes('소비자 단순변심 (고객 배송비 부담 원칙)'), true);
      assert.equal(html.includes('판매자 귀책 (오배송, 상품 하자, 파손 등)'), true);
      assert.equal(html.includes('전액 환불 (청약철회 요청)'), true);
      assert.equal(html.includes('1:1 교환 (동일/대체 상품 맞교환)'), true);
      assert.equal(html.includes('네이버 스마트스토어'), true);
      assert.equal(html.includes('쿠팡 (윙 / 로켓그로스)'), true);
    });

    it('부분환불 3대 합의 요건 체크박스가 모두 렌더링되어야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(InputForm, defaultProps));

      assert.equal(html.includes('[부분환불 요건 1]'), true);
      assert.equal(html.includes('[부분환불 요건 2]'), true);
      assert.equal(html.includes('[부분환불 요건 3]'), true);
    });

    it('환불 요청(REFUND) 상태일 때만 교환 사전 동의 체크박스가 노출되어야 한다', () => {
      const refundHtml = renderToStaticMarkup(React.createElement(InputForm, defaultProps));
      assert.equal(refundHtml.includes('[교환 요건]'), true);

      const exchangeProps: InputFormProps = {
        ...defaultProps,
        flags: {
          ...defaultProps.flags,
          buyerRequest: 'EXCHANGE',
        },
      };
      const exchangeHtml = renderToStaticMarkup(React.createElement(InputForm, exchangeProps));
      assert.equal(exchangeHtml.includes('[교환 요건]'), false);
    });
  });

  describe('3. Validation Summary 및 오류 안내 검증', () => {
    it('에러가 없을 때는 상단 Alert 배너가 렌더링되지 않아야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(InputForm, defaultProps));
      assert.equal(html.includes('입력값 오류를 확인해 주세요'), false);
    });

    it('에러가 발생했을 때 상단 Alert 배너에 에러 요약이 렌더링되어야 한다', () => {
      const errorProps: InputFormProps = {
        ...defaultProps,
        inputErrors: {
          refundAmount: '필수 금액 항목입니다. 금액을 입력해 주세요.',
          agreedPartialRefund: '부분환불액이 전액환불액을 초과할 수 없습니다.',
        },
      };
      const html = renderToStaticMarkup(React.createElement(InputForm, errorProps));
      assert.equal(html.includes('입력값 오류를 확인해 주세요'), true);
      assert.equal(html.includes('필수 금액 항목입니다. 금액을 입력해 주세요.'), true);
      assert.equal(html.includes('부분환불액이 전액환불액을 초과할 수 없습니다.'), true);
    });
  });

  describe('4. 특별 안전조건 검증 (No PII)', () => {
    it('주문번호, 고객명, 전화번호, 배송지 주소 등 개인 식별 정보 입력 필드가 일체 없어야 한다', () => {
      const html = renderToStaticMarkup(React.createElement(InputForm, defaultProps));

      // PII 관련 라벨 및 키워드 검사
      assert.equal(html.includes('주문번호'), false);
      assert.equal(html.includes('고객명') || html.includes('고객 이름') || html.includes('구매자명'), false);
      assert.equal(html.includes('전화번호') || html.includes('연락처') || html.includes('휴대폰'), false);
      assert.equal(html.includes('배송지') || html.includes('주소') || html.includes('우편번호'), false);
    });
  });
});
