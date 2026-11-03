/**
 * P0: Evidence-based, tenant/month scoped reporting.
 *
 * Never infer a standard-return baseline from item price + hypothetical fees.
 * If the exact prior calculation is missing, savings are UNKNOWN (null),
 * not fabricated zero/positive KRW or "tax-proof".
 *
 * All dates are interpreted in Asia/Seoul business months (UTC+09:00).
 */
import type { CaseRecord } from '../../../server/cases/types';
import type { MonthlyReportSummary, MarketBreakdown, OptionBreakdown } from './types';
import { serializeSafeCsv } from '../../../server/batch/csvSanitizer';

const OPTION_NAMES: Record<string, string> = {
  C01:'표준 반품 회수',
  C02:'회수포기 전액환급',
  C03:'자발적 합의 부분환불',
  C15:'1:1 맞교환',
};

function addWon(a: number, b: number): number {
  const total = a + b;
  if (!Number.isSafeInteger(total)) throw new Error('REPORT_MONETARY_OVERFLOW');
  return total;
}

function boundsKst(yearMonth: string): {start: number; end: number} {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(yearMonth);
  if (!m) throw new Error('INVALID_REPORT_YEAR_MONTH');
  const year=Number(m[1]);
  const month=Number(m[2]);
  if(year < 2000 || year > 9998) throw new Error('INVALID_REPORT_YEAR_MONTH');
  const tzOffsetMs=9*60*60*1000;
  return {
    start:Date.UTC(year,month-1,1)-tzOffsetMs,
    end:Date.UTC(year,month,1)-tzOffsetMs,
  };
}

function exactSavings(c: CaseRecord): number | null {
  if (c.bestOptionCode==='C01') return 0; // Chosen option IS standard baseline.
  // Exchange and refund live in different decision groups; comparing them
  // as "savings" would be misleading regardless of a stored refund baseline.
  if (c.bestOptionCode!=='C02' && c.bestOptionCode!=='C03') return null;
  if (typeof c.baselineEconomicCost !== 'number' ||
      !Number.isSafeInteger(c.baselineEconomicCost) ||
      c.baselineEconomicCost < c.economicCost) return null;
  return c.baselineEconomicCost-c.economicCost;
}

function validateAmounts(c: CaseRecord): void {
  if (!Number.isSafeInteger(c.itemPrice) || c.itemPrice<0 ||
      !Number.isSafeInteger(c.cashOutflow) ||
      !Number.isSafeInteger(c.economicCost)) {
    throw new Error('INVALID_REPORT_CASE_MONEY');
  }
}

export function aggregateMonthlyReport(
  tenantId: string,
  yearMonth: string,
  cases: CaseRecord[],
  nowMs: number = Date.now()
): MonthlyReportSummary {
  if (!tenantId || typeof tenantId!=='string' || !Array.isArray(cases) ||
      !Number.isSafeInteger(nowMs)) {
    throw new Error('INVALID_REPORT_SCOPE');
  }
  const {start,end}=boundsKst(yearMonth);
  // A trusted repository query should scope cases already. This function
  // enforces the boundary again as defense-in-depth.
  const scoped=cases.filter(c=>
    c && c.tenantId===tenantId &&
    c.createdAt>=start && c.createdAt<end &&
    c.retentionExpiresAt>nowMs &&
    c.isDeleted===false && c.policyVerified===true
  );
  let totalItemPrice=0;
  let totalCashOutflow=0;
  let totalEconomicCost=0;
  let verifiedSavingSum=0;
  let savingsUnverifiedCases=0;
  const byMarket: Record<string, MarketBreakdown> = Object.create(null);
  const byBestOption: Record<string, OptionBreakdown> = Object.create(null);

  for (const c of scoped) {
    validateAmounts(c);
    totalItemPrice=addWon(totalItemPrice,c.itemPrice);
    totalCashOutflow=addWon(totalCashOutflow,c.cashOutflow);
    totalEconomicCost=addWon(totalEconomicCost,c.economicCost);

    const savings=exactSavings(c);
    if(savings===null) savingsUnverifiedCases++;
    else verifiedSavingSum=addWon(verifiedSavingSum,savings);

    const market=c.market || 'ETC';
    if(!Object.prototype.hasOwnProperty.call(byMarket,market)) {
      byMarket[market]={
        count:0,totalCashOutflow:0,totalEconomicCost:0,
        totalLossMitigated:0,savingsUnverifiedCases:0,
      };
    }
    const marketRow=byMarket[market];
    marketRow.count++;
    marketRow.totalCashOutflow=addWon(marketRow.totalCashOutflow,c.cashOutflow);
    marketRow.totalEconomicCost=addWon(marketRow.totalEconomicCost,c.economicCost);
    if(savings===null) {
      marketRow.savingsUnverifiedCases++;
      marketRow.totalLossMitigated=null;
    } else if(marketRow.totalLossMitigated!==null) {
      marketRow.totalLossMitigated=addWon(marketRow.totalLossMitigated,savings);
    }

    const option=c.bestOptionCode || 'REVIEW_REQUIRED';
    if(!Object.prototype.hasOwnProperty.call(byBestOption,option)) {
      byBestOption[option]={
        count:0,code:option,name:OPTION_NAMES[option]||'기타',
        totalCashOutflow:0,totalEconomicCost:0,
        totalLossMitigated:0,savingsUnverifiedCases:0,
      };
    }
    const optionRow=byBestOption[option];
    optionRow.count++;
    optionRow.totalCashOutflow=addWon(optionRow.totalCashOutflow,c.cashOutflow);
    optionRow.totalEconomicCost=addWon(optionRow.totalEconomicCost,c.economicCost);
    if(savings===null) {
      optionRow.savingsUnverifiedCases++;
      optionRow.totalLossMitigated=null;
    } else if(optionRow.totalLossMitigated!==null) {
      optionRow.totalLossMitigated=addWon(optionRow.totalLossMitigated,savings);
    }
  }
  const count=scoped.length;
  return {
    yearMonth,tenantId,totalCases:count,totalItemPrice,totalCashOutflow,
    totalEconomicCost,
    totalLossMitigated:savingsUnverifiedCases>0?null:verifiedSavingSum,
    savingsUnverifiedCases,
    averageCashOutflowPerCase:count?Math.round(totalCashOutflow/count):0,
    averageEconomicCostPerCase:count?Math.round(totalEconomicCost/count):0,
    byMarket,byBestOption,generatedAt:nowMs,
  };
}

/** Informational comparison CSV only; NOT certified accounting or tax proof. */
export function exportMonthlyReportCsv(summary: MonthlyReportSummary): string {
  const headers=[
    '지표구분','항목명','건수','총추가현금지출(원)','총순경제손실(원)',
    '검증된 기준안 대비 절감추정액(원)','절감액 근거 미확인 건수',
  ];
  const display=(value:number|null):number|string=>
    value===null?'근거 미확인':value;
  const rows:unknown[][]=[[
    '전체합계',`${summary.yearMonth} 종합`,summary.totalCases,
    summary.totalCashOutflow,summary.totalEconomicCost,
    display(summary.totalLossMitigated),summary.savingsUnverifiedCases,
  ]];
  for(const [market,data] of Object.entries(summary.byMarket)) {
    rows.push(['마켓별',market,data.count,data.totalCashOutflow,
      data.totalEconomicCost,display(data.totalLossMitigated),data.savingsUnverifiedCases]);
  }
  for(const [option,data] of Object.entries(summary.byBestOption)) {
    rows.push(['처리방식별',`${data.name} (${option})`,data.count,
      data.totalCashOutflow,data.totalEconomicCost,
      display(data.totalLossMitigated),data.savingsUnverifiedCases]);
  }
  return serializeSafeCsv(headers,rows);
}
