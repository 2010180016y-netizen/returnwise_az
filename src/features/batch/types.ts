/**
 * ReturnWise Pro Batch CSV Calculation Types (src/features/batch/types.ts)
 *
 * SPECIAL SAFETY CONDITIONS:
 * 1. 반품 주문 원본 CSV의 개인정보를 무심코 저장하지 않게 설계 (Drop PII columns in memory).
 * 2. CSV Injection (Formula Injection) 안전 처리.
 */

export interface BatchRowInput {
  rowNumber: number;
  market: string;
  itemPrice: number;
  initialShipping: number;
  returnShipping: number;
  commissionRate: number;
  rawPiiCleaned: Record<string, string | number>;
}

export interface BatchRowResult {
  rowNumber: number;
  market: string;
  itemPrice: number;
  bestOptionCode: string; // 'C01' | 'C02' | 'C03' | 'C15'
  bestOptionName: string;
  cashOutflow: number | null;
  economicCost: number | null;
  savingsVsBaseline: number | null;
  status: 'SUCCESS' | 'REVIEW_REQUIRED' | 'ERROR';
  errorMessage?: string;
}

export interface BatchValidationSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  detectedPiiColumns: string[];
  piiWarning: boolean;
  columnErrors: {
    rowNumber: number;
    column: string;
    message: string;
  }[];
}

export interface BatchProcessingOptions {
  maxRows?: number; // default: 1000
  maxFileSizeMb?: number; // default: 5MB
  concurrencyLimit?: number;
  signal?: AbortSignal;
}
