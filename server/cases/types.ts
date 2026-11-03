/**
 * ReturnWise Pro Server Cases & Lifecycle Types (server/cases/types.ts)
 * SPECIAL SAFETY CONDITION:
 * 고객 이름·주소·주문번호 강제 수집 금지 (No-PII).
 */

export interface CaseRecord {
  id: string;                    // Internal caseId (e.g. 'case_202611_...')
  tenantId: string;
  idempotencyKey?: string;
  market: string;
  itemPrice: number;
  initialShipping: number;
  returnShipping: number;
  commissionRate: number;
  bestOptionCode: string;
  cashOutflow: number;
  economicCost: number;
  /** Exact validated economic cost of standard full-return baseline, if known. */
  baselineEconomicCost?: number;
  policyVerified: boolean;
  retentionExpiresAt: number;
  isDeleted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateCaseInput {
  idempotencyKey?: string;
  market: string;
  itemPrice: number;
  initialShipping: number;
  returnShipping: number;
  commissionRate: number;
  bestOptionCode: string;
  cashOutflow: number;
  economicCost: number;
  /** Optional verified comparison result; no inferred/reconstructed savings. */
  baselineEconomicCost?: number;
  policyVerified?: boolean;
  retentionDays?: number;

  // Potential PII fields that MUST NOT be present
  customerName?: unknown;
  customerAddress?: unknown;
  orderNumber?: unknown;
  phone?: unknown;
}

export interface BackupSnapshot {
  tenantId: string;
  timestamp: number;
  cases: CaseRecord[];
}
