import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CaseRecord } from '../../server/cases/types';
import { aggregateMonthlyReport, exportMonthlyReportCsv } from '../../src/features/reports/reportAggregator';

const startKst = Date.parse('2026-11-01T00:00:00+09:00');
const nowMs = Date.parse('2026-11-04T00:00:00+09:00');

function record(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id:'case_original',
    tenantId:'tenant_a',
    market:'SMARTSTORE',
    itemPrice:30000,
    initialShipping:3000,
    returnShipping:3500,
    commissionRate:5.5,
    bestOptionCode:'C02',
    cashOutflow:15000,
    economicCost:15000,
    baselineEconomicCost:25500,
    policyVerified:true,
    retentionExpiresAt:nowMs+86400000,
    isDeleted:false,
    createdAt:startKst+86400000,
    updatedAt:startKst+86400000,
    ...overrides,
  };
}

describe('P0 | verified monthly report, no fictitious savings',()=>{
  it('uses EXACT recorded baseline rather than item-price-plus-commission guess',()=>{
    const data=aggregateMonthlyReport('tenant_a','2026-11',[record()],nowMs);
    assert.equal(data.totalCases,1);
    assert.equal(data.totalEconomicCost,15000);
    assert.equal(data.totalLossMitigated,10500);
    assert.equal(data.savingsUnverifiedCases,0);
    assert.equal(data.byMarket.SMARTSTORE.totalLossMitigated,10500);
    assert.equal(data.byBestOption.C02.totalLossMitigated,10500);
    const csv=exportMonthlyReportCsv(data);
    assert.match(csv,/10500/);
    assert.doesNotMatch(csv,/16850/);
  });

  it('does NOT invent a positive savings value when reference baseline is absent',()=>{
    const data=aggregateMonthlyReport('tenant_a','2026-11',[
      record({baselineEconomicCost:undefined}),
    ],nowMs);
    assert.equal(data.totalCases,1);
    assert.equal(data.totalLossMitigated,null);
    assert.equal(data.savingsUnverifiedCases,1);
    assert.equal(data.byMarket.SMARTSTORE.totalLossMitigated,null);
    assert.equal(data.byBestOption.C02.totalLossMitigated,null);
    const csv=exportMonthlyReportCsv(data);
    assert.match(csv,/근거 미확인/);
    assert.match(csv,/절감액 근거 미확인 건수/);
  });

  it('one unverified record makes combined savings UNKNOWN instead of a fake partial total',()=>{
    const data=aggregateMonthlyReport('tenant_a','2026-11',[
      record({id:'known',baselineEconomicCost:26000}),
      record({id:'unknown',baselineEconomicCost:undefined}),
    ],nowMs);
    assert.equal(data.totalCases,2);
    assert.equal(data.totalLossMitigated,null);
    assert.equal(data.savingsUnverifiedCases,1);
  });

  it('enforces tenant, Korean calendar month, deletion, retention and policy guard',()=>{
    const data=aggregateMonthlyReport('tenant_a','2026-11',[
      record({id:'valid'}),
      record({id:'other-tenant',tenantId:'tenant_b'}),
      record({id:'previous-month',createdAt:startKst-1}),
      record({id:'next-month',createdAt:Date.parse('2026-12-01T00:00:00+09:00')}),
      record({id:'deleted',isDeleted:true}),
      record({id:'expired',retentionExpiresAt:nowMs-1}),
      record({id:'unverified-policy',policyVerified:false}),
    ],nowMs);
    assert.equal(data.totalCases,1);
    assert.equal(data.totalEconomicCost,15000);
    assert.equal(data.totalLossMitigated,10500);
  });

  it('uses KST midnight rather than UTC midnight for month boundaries',()=>{
    const data=aggregateMonthlyReport('tenant_a','2026-11',[
      record({id:'in-first-second',createdAt:Date.parse('2026-11-01T00:00:00+09:00')}),
      record({id:'oct-final',createdAt:Date.parse('2026-10-31T23:59:59+09:00')}),
      record({id:'nov-final',createdAt:Date.parse('2026-11-30T23:59:59+09:00')}),
    ],nowMs);
    assert.equal(data.totalCases,2);
  });

  it('exchange cannot be compared to standard refund baseline for a saving',()=>{
    const data=aggregateMonthlyReport('tenant_a','2026-11',[
      record({bestOptionCode:'C15',baselineEconomicCost:25000}),
    ],nowMs);
    assert.equal(data.totalCases,1);
    assert.equal(data.totalLossMitigated,null);
  });

  it('selecting exact baseline itself means verified zero savings',()=>{
    const data=aggregateMonthlyReport('tenant_a','2026-11',[
      record({bestOptionCode:'C01',baselineEconomicCost:undefined}),
    ],nowMs);
    assert.equal(data.totalLossMitigated,0);
    assert.equal(data.savingsUnverifiedCases,0);
  });

  it('rejects untrusted period and unsafe numeric data',()=>{
    assert.throws(()=>aggregateMonthlyReport('tenant_a','2026-13',[],nowMs),
      /INVALID_REPORT_YEAR_MONTH/);
    assert.throws(()=>aggregateMonthlyReport('tenant_a','2026-11',[
      record({cashOutflow:Number.POSITIVE_INFINITY}),
    ],nowMs),/INVALID_REPORT_CASE_MONEY/);
  });
});
