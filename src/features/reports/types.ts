/**
 * ReturnWise Pro Monthly Report & Quota Types (src/features/reports/types.ts)
 *
 * SPECIAL SAFETY CONDITION:
 * Pro 관련 현금수익을 사용자의 실제 수익으로 오인시킬 표현 금지.
 * (모든 절감 지표는 '손실 절감액 / 비용 방어액'으로 표기하며, '매출'이나 '순이익'으로 표현하지 않음).
 */

export type PlanTier = 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS';

export interface PlanQuota {
  maxBatchRowsPerMonth: number;
  allowMonthlyReport: boolean;
  allowTaxExport: boolean;
}

export interface MarketBreakdown {
  count: number;
  totalCashOutflow: number;
  totalEconomicCost: number;
  totalLossMitigated: number;
}

export interface OptionBreakdown {
  count: number;
  code: string;
  name: string;
  totalCashOutflow: number;
  totalEconomicCost: number;
}

export interface MonthlyReportSummary {
  yearMonth: string; // e.g. '2026-11'
  tenantId: string;
  totalCases: number;
  totalItemPrice: number;
  totalCashOutflow: number;
  totalEconomicCost: number;
  totalLossMitigated: number; // 보수적 손실 방어액 (NOT 영업이익/매출)
  averageCashOutflowPerCase: number;
  averageEconomicCostPerCase: number;
  byMarket: Record<string, MarketBreakdown>;
  byBestOption: Record<string, OptionBreakdown>;
  generatedAt: number;
}
