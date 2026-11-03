/**
 * ReturnWise Pro Monthly Report & Usage Quota Contract Tests (tests/reports/monthly_report.test.ts)
 * Verifies 1-KRW exact sum matching, monthly/market/option aggregation,
 * server-side quota guards, plan boundaries (Free vs Pro), and anti-profit-misrepresentation safety rule.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 집계 fixture가 단건 합계와 1원 단위로 100% 일치.
 * 2. 권한/사용량 초과 테스트 PASS (403/429).
 * 3. 무료 사용자 Pro 접근 차단.
 * 4. Pro 관련 절감액을 사용자의 실제 '현금 수익/영업이익'으로 오인시킬 표현 금지.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateMonthlyReport,
  exportMonthlyReportCsv,
} from '../../src/features/reports/reportAggregator';
import {
  assertCanAccessMonthlyReport,
  assertCanExportTaxProof,
  assertCanExecuteBatch,
} from '../../server/usage/quotaGuard';
import type { CaseRecord } from '../../server/cases/types';
import type { UserSession } from '../../server/auth/types';
import { AuthError } from '../../server/auth/types';

const currentKstMonth = new Date(Date.now()+9*60*60*1000).toISOString().slice(0,7);

describe('T37 | Monthly Report & Usage Quota Contract', () => {
  const dummySession: UserSession = {
    userId: 'user_test',
    tenantId: 'tenant_test',
    email: 'test@example.com',
    role: 'OWNER',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  describe('1. 1원 단위 정수 합계 무결성 검증 (sum === total)', () => {
    it('10건의 단건 케이스 합계가 월간 집계 결과와 1원의 오차도 없이 100% 일치해야 한다', () => {
      const cases: CaseRecord[] = [];
      let expectedItemPrice = 0;
      let expectedCashOutflow = 0;
      let expectedEconomicCost = 0;

      for (let i = 1; i <= 10; i++) {
        const itemPrice = 10000 * i + 350;
        const cashOutflow = 8000 * i + 120;
        const economicCost = 5000 * i + 70;
        const market = i % 2 === 0 ? 'SMARTSTORE' : 'COUPANG';
        const bestOptionCode = i % 3 === 0 ? 'C02' : 'C01';

        expectedItemPrice += itemPrice;
        expectedCashOutflow += cashOutflow;
        expectedEconomicCost += economicCost;

        cases.push({
          id: `case_${i}`,
          tenantId: 'tenant_test',
          market,
          itemPrice,
          initialShipping: 3000,
          returnShipping: 3000,
          commissionRate: 5.5,
          bestOptionCode,
          cashOutflow,
          economicCost,
          policyVerified: true,
          retentionExpiresAt: Date.now() + 10000000,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      const summary = aggregateMonthlyReport('tenant_test', currentKstMonth, cases);

      // 1. 단건 합계와 월간 종합 합계의 정확한 일치성 확인
      assert.strictEqual(summary.totalCases, 10);
      assert.strictEqual(summary.totalItemPrice, expectedItemPrice);
      assert.strictEqual(summary.totalCashOutflow, expectedCashOutflow);
      assert.strictEqual(summary.totalEconomicCost, expectedEconomicCost);

      // 2. 마켓별 합계의 합이 전체 합계와 일치하는지 확인
      let marketSumCash = 0;
      let marketSumEconomic = 0;
      for (const mktData of Object.values(summary.byMarket)) {
        marketSumCash += mktData.totalCashOutflow;
        marketSumEconomic += mktData.totalEconomicCost;
      }
      assert.strictEqual(marketSumCash, expectedCashOutflow);
      assert.strictEqual(marketSumEconomic, expectedEconomicCost);

      // 3. 처리방식별 합계의 합이 전체 합계와 일치하는지 확인
      let optionSumCash = 0;
      let optionSumEconomic = 0;
      for (const optData of Object.values(summary.byBestOption)) {
        optionSumCash += optData.totalCashOutflow;
        optionSumEconomic += optData.totalEconomicCost;
      }
      assert.strictEqual(optionSumCash, expectedCashOutflow);
      assert.strictEqual(optionSumEconomic, expectedEconomicCost);

      // 4. 모든 수치가 순수 정수(KRW)인지 확인
      assert.ok(Number.isInteger(summary.totalCashOutflow));
      assert.ok(Number.isInteger(summary.totalEconomicCost));
    });
  });

  describe('2. 서버측 플랜 경계 및 사용량 Quota 가드 검증', () => {
    it('무료(FREE) 사용자가 월간 리포트에 접근하려 하면 403 PRO_PLAN_REQUIRED 로 차단되어야 한다', () => {
      assert.throws(
        () => assertCanAccessMonthlyReport(dummySession, 'FREE'),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'PRO_PLAN_REQUIRED');
          return true;
        }
      );
    });

    it('무료(FREE) 사용자가 대량 CSV 일괄 계산을 호출하면 403 에러로 차단되어야 한다', () => {
      assert.throws(
        () => assertCanExecuteBatch(dummySession, 'FREE', 0, 50),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'PRO_PLAN_REQUIRED');
          return true;
        }
      );
    });

    it('Starter 사용자가 월 100건 한도를 초과하여 요청 시 429 QUOTA_EXCEEDED 로 차단되어야 한다', () => {
      // 80건 이미 사용 후 30건 추가 요청 시 (총 110건 > 100건)
      assert.throws(
        () => assertCanExecuteBatch(dummySession, 'STARTER', 80, 30),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 429);
          assert.strictEqual(err.code, 'QUOTA_EXCEEDED');
          return true;
        }
      );
    });

    it('Starter 사용자의 한도 내 요청(80건 사용 중 20건 추가)은 허용되어야 한다', () => {
      assert.doesNotThrow(() => assertCanExecuteBatch(dummySession, 'STARTER', 80, 20));
    });

    it('Starter 사용자는 세무 증빙 리포트 내보내기 시 403 PRO_TIER_REQUIRED 로 차단되어야 한다', () => {
      assert.throws(
        () => assertCanExportTaxProof(dummySession, 'STARTER'),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'PRO_TIER_REQUIRED');
          return true;
        }
      );
    });

    it('Pro 사용자는 무제한 배치 계산 및 세무 리포트 출력이 허용되어야 한다', () => {
      assert.doesNotThrow(() => assertCanExecuteBatch(dummySession, 'PRO', 500, 1000));
      assert.doesNotThrow(() => assertCanAccessMonthlyReport(dummySession, 'PRO'));
      assert.doesNotThrow(() => assertCanExportTaxProof(dummySession, 'PRO'));
    });
  });

  describe('3. 특별 안전조건 검증 (현금 수익 오인 표현 배제)', () => {
    it('리포트 출력물에는 절대로 "영업이익"이나 "현금수익"이라는 왜곡 표현이 포함되어서는 안 된다', () => {
      const cases: CaseRecord[] = [
        {
          id: 'case_1',
          tenantId: 'tenant_test',
          market: 'COUPANG',
          itemPrice: 7000,
          initialShipping: 3000,
          returnShipping: 3500,
          commissionRate: 10.8,
          bestOptionCode: 'C02',
          cashOutflow: 6244,
          economicCost: 6244,
          policyVerified: true,
          retentionExpiresAt: Date.now() + 10000000,
          isDeleted: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      const summary = aggregateMonthlyReport('tenant_test', currentKstMonth, cases);
      const csv = exportMonthlyReportCsv(summary);

      // 보수적 손실 방어 지표 확인
      assert.ok(csv.includes('손실절감액'), '손실절감액 지표가 포함되어야 합니다.');

      // 수익 오인 표현 배제 확인
      assert.ok(!csv.includes('영업이익'), '영업이익 표현이 포함되어서는 안 됩니다.');
      assert.ok(!csv.includes('순수익'), '순수익 표현이 포함되어서는 안 됩니다.');
      assert.ok(!csv.includes('현금매출'), '현금매출 표현이 포함되어서는 안 됩니다.');
      assert.ok(!csv.includes('달러') && !csv.includes('$'), '외화가 혼합되어서는 안 됩니다.');
    });
  });
});
