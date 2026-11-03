/** Server-side only: immutable, priced billing orders. Not exposed to public HTTP. */
import crypto from 'node:crypto';
import type { D1DatabaseLike } from '../worker/d1Types';
import type { PaidTier, BillingOrder } from './verifiedBilling';
import type { ServerSession } from '../worker/sessions';
import { requireOwner } from '../worker/sessions';

export const S3_SANDBOX_PRICES: Readonly<Record<PaidTier, number>> = {
  STARTER: 9900, PRO: 14900,
};

export async function createTrustedBillingOrder(
  db: D1DatabaseLike,
  session: ServerSession,
  plan: PaidTier,
  periodStart: number,
  periodEnd: number,
  mId: string
): Promise<BillingOrder> {
  requireOwner(session);
  if (!(plan in S3_SANDBOX_PRICES) ||
      !Number.isSafeInteger(periodStart) || !Number.isSafeInteger(periodEnd) ||
      periodEnd<=periodStart || periodEnd-periodStart > 35*86400000 ||
      periodStart < Date.now()-86400000 || periodStart > Date.now()+90*86400000 ||
      !mId || mId.length>100) {
    throw new Error('INVALID_SANDBOX_ORDER_INPUT');
  }
  const id='rw_ord_'+crypto.randomBytes(20).toString('hex');
  const amount=S3_SANDBOX_PRICES[plan];
  const now=Date.now();
  const result=await db.prepare(
    `INSERT INTO billing_orders
     (order_id,tenant_id,m_id,amount,plan,period_start,period_end,created_at)
     SELECT ?,t.id,?,?,?,?,?,? FROM tenants t WHERE t.id=? AND t.status='ACTIVE'`
  ).bind(id,mId,amount,plan,periodStart,periodEnd,now,session.tenantId).run();
  if(result.meta.changes!==1) throw new Error('TENANT_NOT_ACTIVE');
  return {orderId:id,tenantId:session.tenantId,mId,amount,plan,periodStart,periodEnd};
}
