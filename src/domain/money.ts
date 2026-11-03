/**
 * ReturnWise Money Parser & Rules (src/domain/money.ts)
 * 100% Pure TypeScript. Zero dependencies on React, DOM, or Browser APIs.
 * SSOT: docs/02_FINANCIAL_DOMAIN.md, docs/CALCULATION_CONTRACT.md
 */

export type MoneyKRW = number;

export const MAX_MONEY_KRW = 1_000_000_000; // 1,000,000,000 KRW (10억 원 상한)
export const MIN_MONEY_KRW = 0; // 음수 불허 (0원 이상)

export type MoneyErrorCode =
  | 'MISSING_REQUIRED'
  | 'INVALID_FORMAT'
  | 'NEGATIVE_NOT_ALLOWED'
  | 'DECIMAL_NOT_ALLOWED'
  | 'MAX_AMOUNT_EXCEEDED';

export interface ParseMoneyOptions {
  required?: boolean;
  fieldName?: string;
  maxAmount?: number;
}

export interface ParseMoneyResult {
  success: boolean;
  value?: MoneyKRW;
  error?: MoneyErrorCode;
  errorMessage?: string;
  isEmpty: boolean;
  isExplicitZero: boolean;
}

export const MONEY_ERROR_MESSAGES: Record<MoneyErrorCode, string> = {
  MISSING_REQUIRED: '필수 금액 항목입니다. 금액을 입력해 주세요.',
  INVALID_FORMAT: '올바른 원 단위 숫자 형식으로 입력해 주세요. (특수문자/문자 불가)',
  NEGATIVE_NOT_ALLOWED: '음수 금액은 입력할 수 없습니다. 0원 이상 입력해 주세요.',
  DECIMAL_NOT_ALLOWED: '소수점은 입력할 수 없습니다. 원 단위 정수로 입력해 주세요.',
  MAX_AMOUNT_EXCEEDED: '최대 허용 금액(10억 원)을 초과할 수 없습니다.',
};

/**
 * 안전한 KRW 정수 금액 파서
 * - 0원과 미입력을 엄격히 분리한다.
 * - `Number(v) || 0` 같은 파괴적 암묵적 강제 변환을 절대 사용하지 않는다.
 */
export function parseMoney(
  input: string | number | null | undefined,
  options: ParseMoneyOptions = {}
): ParseMoneyResult {
  const { required = false, maxAmount = MAX_MONEY_KRW } = options;

  // 1. null, undefined, 빈 값 처리
  if (input === null || input === undefined) {
    if (required) {
      return {
        success: false,
        error: 'MISSING_REQUIRED',
        errorMessage: MONEY_ERROR_MESSAGES.MISSING_REQUIRED,
        isEmpty: true,
        isExplicitZero: false,
      };
    }
    return {
      success: true,
      value: undefined,
      isEmpty: true,
      isExplicitZero: false,
    };
  }

  // 2. 문자열 정규화 (trim)
  const rawString = typeof input === 'number' ? String(input) : input;
  const trimmed = rawString.trim();

  if (trimmed === '') {
    if (required) {
      return {
        success: false,
        error: 'MISSING_REQUIRED',
        errorMessage: MONEY_ERROR_MESSAGES.MISSING_REQUIRED,
        isEmpty: true,
        isExplicitZero: false,
      };
    }
    return {
      success: true,
      value: undefined,
      isEmpty: true,
      isExplicitZero: false,
    };
  }

  // 3. 음수 검사
  if (trimmed.startsWith('-') || trimmed.includes('-')) {
    return {
      success: false,
      error: 'NEGATIVE_NOT_ALLOWED',
      errorMessage: MONEY_ERROR_MESSAGES.NEGATIVE_NOT_ALLOWED,
      isEmpty: false,
      isExplicitZero: false,
    };
  }

  // 4. 소수점 검사
  if (trimmed.includes('.')) {
    return {
      success: false,
      error: 'DECIMAL_NOT_ALLOWED',
      errorMessage: MONEY_ERROR_MESSAGES.DECIMAL_NOT_ALLOWED,
      isEmpty: false,
      isExplicitZero: false,
    };
  }

  // 5. 쉼표(,) 제거 및 숫자 형태 검사
  const cleaned = trimmed.replace(/,/g, '');

  if (!/^\d+$/.test(cleaned)) {
    return {
      success: false,
      error: 'INVALID_FORMAT',
      errorMessage: MONEY_ERROR_MESSAGES.INVALID_FORMAT,
      isEmpty: false,
      isExplicitZero: false,
    };
  }

  // 6. 안전한 정수 파싱
  const parsed = Number(cleaned);

  if (!Number.isSafeInteger(parsed)) {
    return {
      success: false,
      error: 'INVALID_FORMAT',
      errorMessage: MONEY_ERROR_MESSAGES.INVALID_FORMAT,
      isEmpty: false,
      isExplicitZero: false,
    };
  }

  // 7. 상한액 검사
  if (parsed > maxAmount) {
    return {
      success: false,
      error: 'MAX_AMOUNT_EXCEEDED',
      errorMessage: MONEY_ERROR_MESSAGES.MAX_AMOUNT_EXCEEDED,
      isEmpty: false,
      isExplicitZero: false,
    };
  }

  // 8. 정상 파싱 결과 반환 (0원과 양수)
  const isZero = parsed === 0;
  return {
    success: true,
    value: parsed,
    isEmpty: false,
    isExplicitZero: isZero,
  };
}

/**
 * 금액을 한국어 원 단위 문자열로 포맷 (예: 30,000원)
 */
export function formatMoneyKRW(amount: MoneyKRW | undefined | null): string {
  if (amount === undefined || amount === null) return '-';
  return `${amount.toLocaleString('ko-KR')}원`;
}
