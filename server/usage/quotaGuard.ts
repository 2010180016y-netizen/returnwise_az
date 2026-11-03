/**
 * ReturnWise Pro Usage Quota & Feature Boundary Guard (server/usage/quotaGuard.ts)
 * Enforces plan boundaries on the server, preventing unauthorized Pro feature access.
 *
 * SPECIAL SAFETY CONDITION:
 * 서버 검증 없이 UI 숨김으로만 접근 통제 금지.
 * (Server validation is strictly enforced on all Pro endpoints).
 */

import type { UserSession } from '../auth/types';
import { AuthError } from '../auth/types';
import type { PlanTier, PlanQuota } from '../../src/features/reports/types';

export const PLAN_QUOTAS: Record<PlanTier, PlanQuota> = {
  FREE: {
    maxBatchRowsPerMonth: 0,
    allowMonthlyReport: false,
    allowTaxExport: false,
  },
  STARTER: {
    maxBatchRowsPerMonth: 100,
    allowMonthlyReport: true,
    allowTaxExport: false,
  },
  PRO: {
    maxBatchRowsPerMonth: Infinity,
    allowMonthlyReport: true,
    allowTaxExport: true,
  },
  BUSINESS: {
    maxBatchRowsPerMonth: Infinity,
    allowMonthlyReport: true,
    allowTaxExport: true,
  },
};

/**
 * Asserts that the session's plan allows monthly report viewing
 */
export function assertCanAccessMonthlyReport(session: UserSession, plan: PlanTier): void {
  if (!session || !session.tenantId) {
    throw new AuthError(401, 'UNAUTHORIZED', '인증되지 않은 요청입니다.');
  }

  const quota = PLAN_QUOTAS[plan];
  if (!quota || !quota.allowMonthlyReport) {
    throw new AuthError(
      403,
      'PRO_PLAN_REQUIRED',
      '월간 리포트 분석 기능은 Starter 또는 Pro 요금제 전용 기능입니다.'
    );
  }
}

/**
 * Asserts that the session's plan allows tax export download
 */
export function assertCanExportTaxProof(session: UserSession, plan: PlanTier): void {
  if (!session || !session.tenantId) {
    throw new AuthError(401, 'UNAUTHORIZED', '인증되지 않은 요청입니다.');
  }

  const quota = PLAN_QUOTAS[plan];
  if (!quota || !quota.allowTaxExport) {
    throw new AuthError(
      403,
      'PRO_TIER_REQUIRED',
      '세무 정산 증빙 리포트 내보내기 기능은 Pro 요금제 이상에서만 지원됩니다.'
    );
  }
}

/**
 * Asserts that the session's plan allows batch processing and has not exceeded monthly quota
 */
export function assertCanExecuteBatch(
  session: UserSession,
  plan: PlanTier,
  currentUsageCount: number,
  requestedRowCount: number
): void {
  if (!session || !session.tenantId) {
    throw new AuthError(401, 'UNAUTHORIZED', '인증되지 않은 요청입니다.');
  }

  const quota = PLAN_QUOTAS[plan];
  if (!quota || quota.maxBatchRowsPerMonth === 0) {
    throw new AuthError(
      403,
      'PRO_PLAN_REQUIRED',
      '대용량 CSV 일괄 계산 기능은 유료 요금제 전용 기능입니다.'
    );
  }

  if (currentUsageCount + requestedRowCount > quota.maxBatchRowsPerMonth) {
    throw new AuthError(
      429,
      'QUOTA_EXCEEDED',
      `월간 허용된 일괄 계산 한도(${quota.maxBatchRowsPerMonth}건)를 초과했습니다. (현재 사용량: ${currentUsageCount}건, 요청: ${requestedRowCount}건)`
    );
  }
}
