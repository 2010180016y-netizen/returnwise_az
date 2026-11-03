import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, formatMoneyKRW, MAX_MONEY_KRW } from '../../src/domain/money';
import { validateReturnInputs } from '../../src/domain/validation';

describe('T06 | Money Parser & Boundary Validation Engine', () => {
  describe('1. 0원과 미입력(Empty) 엄격 구분 (C10, C12)', () => {
    it('0원은 유효한 숫자로 정상 인식되어야 한다 (isExplicitZero: true)', () => {
      const res1 = parseMoney('0', { required: true });
      assert.equal(res1.success, true);
      assert.equal(res1.value, 0);
      assert.equal(res1.isExplicitZero, true);
      assert.equal(res1.isEmpty, false);

      const res2 = parseMoney(0, { required: true });
      assert.equal(res2.success, true);
      assert.equal(res2.value, 0);
      assert.equal(res2.isExplicitZero, true);

      const res3 = parseMoney('  0  ', { required: true });
      assert.equal(res3.success, true);
      assert.equal(res3.value, 0);
      assert.equal(res3.isExplicitZero, true);

      const res4 = parseMoney('000', { required: true });
      assert.equal(res4.success, true);
      assert.equal(res4.value, 0);
      assert.equal(res4.isExplicitZero, true);
    });

    it('필수 입력값에 null/undefined/공백 전달 시 MISSING_REQUIRED 에러를 반환해야 한다 (C12)', () => {
      const emptyValues = [null, undefined, '', '   ', '\t', '\n'];
      for (const val of emptyValues) {
        const res = parseMoney(val, { required: true });
        assert.equal(res.success, false, `Failed for ${val}`);
        assert.equal(res.error, 'MISSING_REQUIRED');
        assert.equal(res.isEmpty, true);
        assert.equal(res.isExplicitZero, false);
      }
    });

    it('선택 입력값(optional)에 빈 값 전달 시 에러 없이 undefined를 반환해야 한다', () => {
      const res = parseMoney('', { required: false });
      assert.equal(res.success, true);
      assert.equal(res.value, undefined);
      assert.equal(res.isEmpty, true);
    });
  });

  describe('2. 비정상 입력 차단 (20개 이상 반례 검증 - C11)', () => {
    it('음수 입력 시 NEGATIVE_NOT_ALLOWED 에러 반환', () => {
      const negativeInputs = ['-1', '-5000', '-30,000', '-0.5', '-100', '-9999999'];
      for (const input of negativeInputs) {
        const res = parseMoney(input);
        assert.equal(res.success, false, `Failed for ${input}`);
        assert.equal(res.error, 'NEGATIVE_NOT_ALLOWED');
      }
    });

    it('소수점 입력 시 DECIMAL_NOT_ALLOWED 에러 반환', () => {
      const decimalInputs = ['12.5', '0.1', '100.00', '30000.5', '99.99', '.5'];
      for (const input of decimalInputs) {
        const res = parseMoney(input);
        assert.equal(res.success, false, `Failed for ${input}`);
        assert.equal(res.error, 'DECIMAL_NOT_ALLOWED');
      }
    });

    it('문자열, 단위, 지수 표기, NaN, 특수문자 입력 시 형식 에러 반환', () => {
      const invalidFormats = [
        'abc',
        '30000원',
        '30,000원',
        '만원',
        '30 000',
        'NaN',
        'Infinity',
        '-Infinity',
        '1e5',
        '$$$',
        '123a',
        '30k',
        'undefined',
        '[object Object]',
        '30,000.00',
      ];
      for (const input of invalidFormats) {
        const res = parseMoney(input);
        assert.equal(res.success, false, `Failed for ${input}`);
        assert.equal(
          res.error === 'INVALID_FORMAT' ||
            res.error === 'DECIMAL_NOT_ALLOWED' ||
            res.error === 'NEGATIVE_NOT_ALLOWED',
          true,
          `Unexpected error for ${input}: ${res.error}`
        );
      }
    });
  });

  describe('3. 금액 상한선 경계값 검증 (C13)', () => {
    it('최대 허용 금액(1,000,000,000원)은 정상 통과해야 한다', () => {
      const res = parseMoney(MAX_MONEY_KRW);
      assert.equal(res.success, true);
      assert.equal(res.value, 1_000_000_000);

      const resString = parseMoney('1,000,000,000');
      assert.equal(resString.success, true);
      assert.equal(resString.value, 1_000_000_000);
    });

    it('10억 1원 이상 초과 시 MAX_AMOUNT_EXCEEDED 에러를 반환해야 한다', () => {
      const overflowInputs = [
        1_000_000_001,
        '1,000,000,001',
        '1000000001',
        '999,999,999,999',
      ];
      for (const input of overflowInputs) {
        const res = parseMoney(input);
        assert.equal(res.success, false, `Failed for ${input}`);
        assert.equal(res.error, 'MAX_AMOUNT_EXCEEDED');
      }
    });
  });

  describe('4. 공백 및 쉼표 정규화 검증', () => {
    it('쉼표가 포함된 문자열을 순수 정수로 정확히 파싱해야 한다', () => {
      assert.equal(parseMoney('30,000').value, 30000);
      assert.equal(parseMoney('  150,000  ').value, 150000);
      assert.equal(parseMoney('1,234,567').value, 1234567);
    });

    it('formatMoneyKRW 포맷터가 한국어 원 단위로 정확히 반환해야 한다', () => {
      assert.equal(formatMoneyKRW(30000), '30,000원');
      assert.equal(formatMoneyKRW(0), '0원');
      assert.equal(formatMoneyKRW(1000000), '1,000,000원');
      assert.equal(formatMoneyKRW(undefined), '-');
      assert.equal(formatMoneyKRW(null), '-');
    });
  });

  describe('5. validateReturnInputs 폼 단위 및 크로스 필드 검증 (C10, C11, C12, L02)', () => {
    it('모든 금액이 0원일 때 유효한 입력으로 통과해야 한다 (C10)', () => {
      const validation = validateReturnInputs({
        refundAmount: '0',
        reverseShippingSellerCost: '0',
        handlingCost: '0',
        recoveredItemNetValue: '0',
      });
      assert.equal(validation.isValid, true);
      assert.equal(validation.parsedInputs?.refundAmount, 0);
      assert.equal(validation.parsedInputs?.reverseShippingSellerCost, 0);
    });

    it('필수값 refundAmount 누락 시 유효성 검증 실패해야 한다 (C12)', () => {
      const validation = validateReturnInputs({
        refundAmount: '',
      });
      assert.equal(validation.isValid, false);
      assert.equal(validation.fieldErrors.refundAmount.code, 'MISSING_REQUIRED');
    });

    it('부분환불액이 전액환불액을 초과하면 에러를 발생시켜야 한다', () => {
      const validation = validateReturnInputs({
        refundAmount: '30,000',
        agreedPartialRefund: '40,000',
      });
      assert.equal(validation.isValid, false);
      assert.equal(
        validation.fieldErrors.agreedPartialRefund.code,
        'PARTIAL_EXCEEDS_FULL'
      );
    });

    it('판매자 귀책 사유인데 고객에게 반품비를 청구하면 L02 가드레일에 의해 차단되어야 한다', () => {
      const validation = validateReturnInputs(
        {
          refundAmount: '30,000',
          reverseShippingSellerCost: '0',
          reverseShippingBuyerCost: '3,500',
        },
        { reason: 'SELLER_FAULT' }
      );
      assert.equal(validation.isValid, false);
      assert.equal(
        validation.fieldErrors.reverseShippingBuyerCost.code,
        'SELLER_FAULT_BUYER_CHARGE_FORBIDDEN'
      );
    });
  });
});
