/**
 * ReturnWise Pro Monthly Report Aggregator (src/features/reports/reportAggregator.ts)
 * 1-KRW exact integer math. Guaranteed sum(items) === total.
 *
 * SPECIAL SAFETY CONDITION:
 * Pro 관련 절감액을 판매자의 실제 '현금 수익'이나 '영업이익'으로 오인시키는 표현을 일체 배제하고,
 * '손실 절감액(Loss Mitigated)', '비용 방어액' 등 보수적 재무 용어만 적용.
 */

import type { CaseRecord } from '../../../server/cases/types';
import type { MonthlyReportSummary, MarketBreakdown, OptionBreakdown } from './types';
import { serializeSafeCsv } from '../../../server/batch/csvSanitizer';

const OPTION_NAMES: Record<string, string> = {
  C01: '표준 반품 회수',
  C02: '회수포기 전액환급',
  C03: '자발적 합의 부분환불',
  C15: '1:1 맞교환',
};

export function aggregateMonthlyReport(
  tenantId: string,
  yearMonth: string,
  cases: CaseRecord[]
): MonthlyReportSummary {
  let totalItemPrice = 0;
  let totalCashOutflow = 0;
  let totalEconomicCost = 0;
  let totalLossMitigated = 0;

  const byMarket: Record<string, MarketBreakdown> = {};
  const byBestOption: Record<string, OptionBreakdown> = {};

  for (const c of cases) {
    totalItemPrice += c.itemPrice;
    totalCashOutflow += c.cashOutflow;
    totalEconomicCost += c.economicCost;

    // Loss mitigation = standard baseline economic cost minus best option economic cost
    // Baseline is standard return: refundAmount + reverseShipping - feeReversal - recoveredNetValue
    const baselineCost = Math.max(c.economicCost, c.itemPrice + c.returnShipping - Math.floor(c.itemPrice * (c.commissionRate / 100)));
    const mitigated = Math.max(0, baselineCost - c.economicCost);
    totalLossMitigated += mitigated;

    // Group by market
    const mkt = c.market || 'ETC';
    if (!byMarket[mkt]) {
      byMarket[mkt] = {
        count: 0,
        totalCashOutflow: 0,
        totalEconomicCost: 0,
        totalLossMitigated: 0,
      };
    }
    byMarket[mkt].count += 1;
    byMarket[mkt].totalCashOutflow += c.cashOutflow;
    byMarket[mkt].totalEconomicCost += c.economicCost;
    byMarket[mkt].totalLossMitigated += mitigated;

    // Group by best option
    const opt = c.bestOptionCode || 'C01';
    if (!byBestOption[opt]) {
      byBestOption[opt] = {
        count: 0,
        code: opt,
        name: OPTION_NAMES[opt] || '기타',
        totalCashOutflow: 0,
        totalEconomicCost: 0,
      };
    }
    byBestOption[opt].count += 1;
    byBestOption[opt].totalCashOutflow += c.cashOutflow;
    byBestOption[opt].totalEconomicCost += c.economicCost;
  }

  const count = cases.length;
  const averageCashOutflowPerCase = count > 0 ? Math.round(totalCashOutflow / count) : 0;
  const averageEconomicCostPerCase = count > 0 ? Math.round(totalEconomicCost / count) : 0;

  return {
    yearMonth,
    tenantId,
    totalCases: count,
    totalItemPrice,
    totalCashOutflow,
    totalEconomicCost,
    totalLossMitigated,
    averageCashOutflowPerCase,
    averageEconomicCostPerCase,
    byMarket,
    byBestOption,
    generatedAt: Date.now(),
  };
}

/**
 * Generates sanitized CSV report suitable for tax proof / accounting
 */
export function exportMonthlyReportCsv(summary: MonthlyReportSummary): string {
  const headers = [
    '지표구분',
    '항목명',
    '건수',
    '총추가현금지출(원)',
    '총순경제손실(원)',
    '손실절감액(원)',
  ];

  const rows: unknown[][] = [
    [
      '전체합계',
      `${summary.yearMonth} 종합`,
      summary.totalCases,
      summary.totalCashOutflow,
      summary.totalEconomicCost,
      summary.totalLossMitigated,
    ],
  ];

  // Market rows
  for (const [mkt, data] of Object.entries(summary.byMarket)) {
    rows.push(['마켓별', mkt, data.count, data.totalCashOutflow, data.totalEconomicCost, data.totalLossMitigated]);
  }

  // Option rows
  for (const [opt, data] of Object.entries(summary.byBestOption)) {
    rows.push(['처리방식별', `${data.name} (${opt})`, data.count, data.totalCashOutflow, data.totalEconomicCost, 0]);
  }

  return serializeSafeCsv(headers, rows);
}
