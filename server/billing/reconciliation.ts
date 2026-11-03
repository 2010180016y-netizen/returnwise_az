/**
 * P0: fair, durable sandbox reconciliation of payments ALREADY verified.
 *
 * Each pass takes up to 50 due orders and persists next_reconcile_at for
 * both success and failed provider lookups. This prevents starvation when
 * 51+ active orders exist and permits retry after outages without charging.
 *
 * No LIVE key, new charges, or billing-key creation is performed here.
 */
import crypto from 'node:crypto';
import type { D1DatabaseLike } from '../worker/d1Types';
import type { PaymentLookup, VerifiedPaymentStatus, VerifiedSubscriptionStatus } from './verifiedBilling';
import { createD1BillingLedger } from './d1BillingLedger';

const STATUSES = new Set(['DONE','CANCELED','PARTIAL_CANCELED','ABORTED','EXPIRED']);
const SUCCESS_DELAY_MS = 60 * 60 * 1000; // Revisit after an hour.
const INITIAL_RETRY_MS = 5 * 60 * 1000;
const MAX_RETRY_MS = 60 * 60 * 1000;

const toState=(status:VerifiedPaymentStatus):VerifiedSubscriptionStatus=>
  status==='DONE'?'ACTIVE':
  status==='CANCELED'||status==='PARTIAL_CANCELED'?'REFUNDED':'PAST_DUE';

interface DueOrder {
  order_id: string;
  payment_key: string;
  reconcile_attempts: number;
}
export async function reconcileSandboxPayments(
  db: D1DatabaseLike,
  lookup: PaymentLookup,
  nowMs: number = Date.now()
): Promise<{scanned:number;updated:number;duplicates:number;failed:number}> {
  if (!Number.isSafeInteger(nowMs) || nowMs <= 0) {
    throw new Error('INVALID_RECONCILIATION_TIME');
  }

  const {results}=await db.prepare(
    `SELECT order_id,payment_key,reconcile_attempts FROM billing_orders
     WHERE payment_key IS NOT NULL AND status IN ('ACTIVE','PAST_DUE')
       AND period_end > ? AND next_reconcile_at <= ?
     ORDER BY next_reconcile_at ASC, order_id ASC LIMIT 50`
  ).bind(nowMs-30*86400000,nowMs).all<DueOrder>();

  const ledger=createD1BillingLedger(db);
  const summary={scanned:results.length,updated:0,duplicates:0,failed:0};
  for(const row of results) {
    let failed = false;
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
      failed=true;
    }

    const attempts=failed
      ? Math.min(20,Math.max(0,row.reconcile_attempts)+1)
      : 0;
    const delay=failed
      ? Math.min(MAX_RETRY_MS,INITIAL_RETRY_MS * 2**Math.min(attempts-1,4))
      : SUCCESS_DELAY_MS;

    try {
      // Persist the scheduling cursor independently of the ledger event.
      // A failed lookup must not keep the same record first in every batch.
      await db.prepare(
        `UPDATE billing_orders
         SET next_reconcile_at=?, reconcile_attempts=?
         WHERE order_id=? AND payment_key=?`
      ).bind(nowMs+delay,attempts,row.order_id,row.payment_key).run();
    } catch {
      if(!failed) summary.failed++;
      // The next run retries this order. Never fake a successful audit.
    }
  }
  return summary;
}
