/**
 * Trusted background reconciliation for previously verified payments.
 * Never calls a charge API. It only reads Toss payment status and advances
 * the durable ledger when merchant/order/amount/payment key match.
 */
import crypto from 'node:crypto';
import type { D1DatabaseLike } from '../worker/d1Types';
import type { PaymentLookup, VerifiedPaymentStatus, VerifiedSubscriptionStatus } from './verifiedBilling';
import { createD1BillingLedger } from './d1BillingLedger';

const STATUSES = new Set(['DONE','CANCELED','PARTIAL_CANCELED','ABORTED','EXPIRED']);
const toState=(status:VerifiedPaymentStatus):VerifiedSubscriptionStatus=>
  status==='DONE'?'ACTIVE':
  status==='CANCELED'||status==='PARTIAL_CANCELED'?'REFUNDED':'PAST_DUE';

export async function reconcileSandboxPayments(
  db: D1DatabaseLike,
  lookup: PaymentLookup,
  nowMs: number = Date.now()
): Promise<{scanned:number;updated:number;duplicates:number;failed:number}> {
  const {results}=await db.prepare(
    `SELECT order_id,payment_key FROM billing_orders
     WHERE payment_key IS NOT NULL AND status IN ('ACTIVE','PAST_DUE')
       AND period_end > ? ORDER BY last_event_at ASC LIMIT 50`
  ).bind(nowMs-30*86400000).all<{order_id:string;payment_key:string}>();

  const ledger=createD1BillingLedger(db);
  const summary={scanned:results.length,updated:0,duplicates:0,failed:0};
  for(const row of results) {
    try {
      const order=await ledger.findOrder(row.order_id);
      if(!order || !row.payment_key) throw Error('UNVERIFIED_ORDER');
      const payment=await lookup.getPayment(row.payment_key);
      if(!payment || payment.paymentKey!==row.payment_key ||
        payment.orderId!==order.orderId ||
        payment.mId!==order.mId ||
        payment.totalAmount!==order.amount ||
        !STATUSES.has(payment.status)) throw Error('MISMATCHED_PROVIDER_PROOF');

      const status=toState(payment.status);
      const eventKey='reconcile:' + crypto.createHash('sha256')
        .update(order.orderId+':'+payment.paymentKey+':'+status).digest('hex');
      const outcome=await ledger.applyVerified({
        eventKey,orderId:order.orderId,tenantId:order.tenantId,
        paymentKey:payment.paymentKey,amount:order.amount,mId:order.mId,
        plan:order.plan,status,periodStart:order.periodStart,
        periodEnd:order.periodEnd,occurredAt:nowMs,
      });
      if(outcome==='APPLIED') summary.updated++;
      else summary.duplicates++;
    } catch {
      summary.failed++;
    }
  }
  return summary;
}
