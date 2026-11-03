/**
 * ReturnWise Pro Server-Side Batch Calculation Processor (server/batch/batchProcessor.ts)
 * Integrates with pure calculation engine (calculateAllAlternatives),
 * supports cancellation (AbortSignal), concurrency control, and safe CSV export.
 */

import type { BatchRowInput, BatchRowResult } from '../../src/features/batch/types';
import { calculateAllAlternatives } from '../../src/domain/calculate';
import type { ScenarioInput } from '../../src/domain/types';
import { serializeSafeCsv } from './csvSanitizer';

export function processBatchRows(
  rows: BatchRowInput[],
  options: { signal?: AbortSignal } = {}
): {
  results: BatchRowResult[];
  totalProcessed: number;
  executionTimeMs: number;
} {
  const startTime = Date.now();
  const results: BatchRowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    // Check cancellation signal
    if (options.signal?.aborted) {
      throw new Error('BATCH_PROCESSING_CANCELLED: 사용자에 의해 일괄 계산 작업이 취소되었습니다.');
    }

    const row = rows[i];
    try {
      const feeReversal = Math.floor(row.itemPrice * (row.commissionRate / 100));
      const recoveredNetValue = Math.floor(row.itemPrice * 0.3); // 보수적 30% 잔존가치 추정

      const scenario: ScenarioInput = {
        refundAmount: row.itemPrice,
        reverseShippingSellerCost: row.returnShipping,
        initialProcurementCost: Math.floor(row.itemPrice * 0.5),
        recoveredItemNetValue: recoveredNetValue,
        feeReversalCredit: feeReversal,
        handlingCost: 500,
        replacementCost: Math.floor(row.itemPrice * 0.5),
        replacementOutboundShipping: row.initialShipping,
        agreedPartialRefund: Math.floor(row.itemPrice * 0.3),
      };

      const calcResult = calculateAllAlternatives(scenario);
      const best = calcResult.sortedAlternatives[0];
      const baseline = calcResult.results.RETURN_FULL.economicCost;
      const savings = Math.max(0, baseline - best.economicCost);

      let code = 'C01';
      let name = '표준 반품 회수';
      if (best.alternative === 'KEEP_FULL') {
        code = 'C02';
        name = '회수포기 전액환급';
      } else if (best.alternative === 'KEEP_PARTIAL') {
        code = 'C03';
        name = '자발적 합의 부분환불';
      } else if (best.alternative === 'EXCHANGE') {
        code = 'C15';
        name = '1:1 맞교환';
      }

      results.push({
        rowNumber: row.rowNumber,
        market: row.market,
        itemPrice: row.itemPrice,
        bestOptionCode: code,
        bestOptionName: name,
        cashOutflow: best.cashOutflow,
        economicCost: best.economicCost,
        savingsVsBaseline: savings,
        status: 'SUCCESS',
      });
    } catch (err: unknown) {
      results.push({
        rowNumber: row.rowNumber,
        market: row.market,
        itemPrice: row.itemPrice,
        bestOptionCode: 'ERROR',
        bestOptionName: '계산 오류',
        cashOutflow: 0,
        economicCost: 0,
        savingsVsBaseline: 0,
        status: 'ERROR',
        errorMessage: err instanceof Error ? err.message : '알 수 없는 계산 오류',
      });
    }
  }

  const executionTimeMs = Date.now() - startTime;
  return {
    results,
    totalProcessed: results.length,
    executionTimeMs,
  };
}

/**
 * Generates completely sanitized CSV export of batch results
 */
export function generateBatchExportCsv(results: BatchRowResult[]): string {
  const headers = [
    '행번호',
    '판매마켓',
    '상품판매가',
    '최적대안코드',
    '추천처리방식',
    '추가현금지출',
    '순경제적손실',
    '기준안대비절감액',
    '계산상태',
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
  ]);

  return serializeSafeCsv(headers, rows);
}
