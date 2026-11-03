/**
 * Conservative batch import boundary.
 *
 * A price/shipping CSV does not include the customer's consent, marketplace policy,
 * actual item salvage value, verified commission reversal, or replacement costs.
 * It must NEVER invent these values and publish a "best option".
 *
 * Future paid implementation: extend the input schema with independently verified
 * financial facts and explicit policy flags; call compareAlternatives per row.
 */
import type { BatchRowInput, BatchRowResult } from '../../src/features/batch/types';
import { serializeSafeCsv } from './csvSanitizer';

export function processBatchRows(
  rows: BatchRowInput[],
  options: { signal?: AbortSignal } = {}
): { results: BatchRowResult[]; totalProcessed: number; executionTimeMs: number } {
  const startTime = Date.now();
  const results: BatchRowResult[] = [];

  for (const row of rows) {
    if (options.signal?.aborted) {
      throw new Error('BATCH_PROCESSING_CANCELLED: 사용자에 의해 일괄 계산 작업이 취소되었습니다.');
    }
    const valid =
      Number.isSafeInteger(row.itemPrice) &&
      row.itemPrice >= 0 &&
      Number.isSafeInteger(row.initialShipping) &&
      row.initialShipping >= 0 &&
      Number.isSafeInteger(row.returnShipping) &&
      row.returnShipping >= 0 &&
      Number.isFinite(row.commissionRate) &&
      row.commissionRate >= 0 &&
      row.commissionRate <= 100;

    results.push({
      rowNumber: row.rowNumber,
      market: row.market,
      itemPrice: row.itemPrice,
      bestOptionCode: valid ? 'REVIEW_REQUIRED' : 'ERROR',
      bestOptionName: valid ? '처리 조건 확인 필요' : '입력 검증 실패',
      cashOutflow: null,
      economicCost: null,
      savingsVsBaseline: null,
      status: valid ? 'REVIEW_REQUIRED' : 'ERROR',
      errorMessage: valid
        ? '단순 판매가 CSV만으로는 고객 동의·플랫폼 정책·상품 회수가치 등을 알 수 없어 최저비용 대안을 산출하지 않습니다.'
        : '유효한 판매가/배송비/수수료율이 필요합니다.',
    });
  }

  return { results, totalProcessed: results.length, executionTimeMs: Date.now() - startTime };
}

/** Do not export null estimates as a misleading 0-KRW saving. */
export function generateBatchExportCsv(results: BatchRowResult[]): string {
  const headers = [
    '행번호', '판매마켓', '상품판매가', '최적대안코드', '추천처리방식',
    '추가현금지출', '순경제적손실', '기준안대비절감액', '계산상태', '검토사항',
  ];
  const rows = results.map((r) => [
    r.rowNumber,
    r.market,
    r.itemPrice,
    r.bestOptionCode,
    r.bestOptionName,
    r.cashOutflow,
    r.economicCost,
    r.savingsVsBaseline,
    r.status,
    r.errorMessage ?? '',
  ]);
  return serializeSafeCsv(headers, rows);
}
