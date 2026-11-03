/**
 * P1: persistent D1-backed batch row quota.
 * Do not trust browser-provided plan or usage totals; read server entitlement
 * and reserve once via D1's atomic batch plus SQLite trigger.
 *
 * This module is an internal entry point for a future Pro batch executor.
 * The public HTTP batch-upload endpoint remains DISABLED until real login,
 * consent and storage review. No payments are performed here.
 */
import type { D1DatabaseLike } from '../worker/d1Types';
import type { ServerSession } from '../worker/sessions';
import { readD1Entitlement } from '../billing/d1BillingLedger';

export class D1QuotaError extends Error {
  constructor(public readonly code: string, public readonly statusCode: 400|403|409|429) {
    super(code);
    this.name='D1QuotaError';
  }
}

const MAX_BATCH_ROWS=1000;
const MONTH_CAP: Record<'STARTER'|'PRO',number> = {
  STARTER:100,
  // A finite operational safety cap prevents accidental unbounded resource
  // consumption. Business-tier unlimited claims are NOT implemented here.
  PRO:100000,
};

function kstMonth(nowMs:number):string {
  if (!Number.isSafeInteger(nowMs) || nowMs<0 || nowMs>8_640_000_000_000_000) {
    throw new D1QuotaError('INVALID_TIME',400);
  }
  return new Date(nowMs+9*60*60*1000).toISOString().slice(0,7);
}

function assertSession(session:ServerSession):void {
  if (!session?.tenantId || !session?.userId || !session?.sessionHash ||
      (session.role!=='OWNER' && session.role!=='MEMBER')) {
    throw new D1QuotaError('VERIFIED_SESSION_REQUIRED',403);
  }
}

async function trustedPlan(db:D1DatabaseLike,tenantId:string,nowMs:number) {
  const entitlement=await readD1Entitlement(db,tenantId,nowMs);
  if (entitlement.status!=='ACTIVE' || entitlement.plan==='FREE') {
    throw new D1QuotaError('PAID_PLAN_REQUIRED',403);
  }
  return entitlement.plan;
}

export async function getTrustedQuotaUsage(
  db:D1DatabaseLike,session:ServerSession,nowMs:number=Date.now()
):Promise<{month:string;plan:'STARTER'|'PRO';usedRows:number;limitRows:number}> {
  assertSession(session);
  const month=kstMonth(nowMs);
  const plan=await trustedPlan(db,session.tenantId,nowMs);
  const row=await db.prepare(
    `SELECT used_rows FROM quota_usage WHERE tenant_id=? AND month=?`
  ).bind(session.tenantId,month).first<{used_rows:number}>();
  return {month,plan,usedRows:row?.used_rows??0,limitRows:MONTH_CAP[plan]};
}

export async function reserveTrustedBatchRows(
  db:D1DatabaseLike,session:ServerSession,
  requestId:string,rowCount:number,nowMs:number=Date.now()
):Promise<{outcome:'RESERVED'|'DUPLICATE';usedRows:number;limitRows:number;month:string}> {
  assertSession(session);
  const month=kstMonth(nowMs);
  if(typeof requestId!=='string' || !/^[A-Za-z0-9_-]{12,120}$/.test(requestId) ||
     !Number.isSafeInteger(rowCount) || rowCount<1 || rowCount>MAX_BATCH_ROWS) {
    throw new D1QuotaError('INVALID_BATCH_RESERVATION',400);
  }

  // Never accept the caller's claimed plan, quota or count of used rows.
  const plan=await trustedPlan(db,session.tenantId,nowMs);
  const max=MONTH_CAP[plan];

  let result:'RESERVED'|'DUPLICATE'='RESERVED';
  try {
    const batch=await db.batch([
      db.prepare(
        `INSERT INTO quota_usage(tenant_id,month,used_rows,updated_at)
         SELECT ?,?,0,? WHERE EXISTS (
           SELECT 1 FROM tenants WHERE id=? AND status='ACTIVE')
         ON CONFLICT(tenant_id,month) DO NOTHING`
      ).bind(session.tenantId,month,nowMs,session.tenantId),
      db.prepare(
        `INSERT INTO quota_reservations
           (tenant_id,request_id,month,row_count,plan,limit_rows,created_at)
         SELECT ?,?,?,?,?,?,?
         WHERE EXISTS (
           SELECT 1 FROM billing_entitlements AS e
           JOIN tenants AS t ON t.id=e.tenant_id
           WHERE e.tenant_id=? AND e.plan=? AND e.status='ACTIVE'
             AND t.status='ACTIVE' AND e.period_start<=? AND e.period_end>?
         )`
      ).bind(
        session.tenantId,requestId,month,rowCount,plan,max,nowMs,
        session.tenantId,plan,nowMs,nowMs
      ),
    ]);
    if (batch[1]?.meta.changes!==1) {
      throw new D1QuotaError('ENTITLEMENT_CHANGED',403);
    }
  } catch(error) {
    const message=error instanceof Error?error.message:'';
    if (/QUOTA_EXCEEDED/.test(message)) {
      throw new D1QuotaError('QUOTA_EXCEEDED',429);
    }
    if (!/UNIQUE constraint failed|PRIMARY KEY constraint failed|SQLITE_CONSTRAINT/i.test(message)) {
      throw error;
    }
    // A same-tenant replay must not consume rows twice. Different row count,
    // month or plan under the same requestId is a hard conflict.
    const previous=await db.prepare(
      `SELECT month,row_count,plan FROM quota_reservations
       WHERE tenant_id=? AND request_id=?`
    ).bind(session.tenantId,requestId)
      .first<{month:string;row_count:number;plan:string}>();
    if (!previous || previous.month!==month ||
        previous.row_count!==rowCount || previous.plan!==plan) {
      throw new D1QuotaError('QUOTA_REPLAY_CONFLICT',409);
    }
    result='DUPLICATE';
  }
  const usage=await getTrustedQuotaUsage(db,session,nowMs);
  return {outcome:result,usedRows:usage.usedRows,limitRows:usage.limitRows,month};
}
