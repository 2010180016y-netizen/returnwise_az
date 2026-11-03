/**
 * Verifies a server-initiated Toss payment / recurring-billing result.
 * PAYMENT_STATUS_CHANGED does NOT have a signed webhook header; never treat
 * an inbound unsigned notification as payment proof.
 *
 * This endpoint performs no charge or billing-key registration.
 */
import crypto from 'node:crypto';
import type { BillingLedger, PaymentLookup, VerifiedPaymentStatus, VerifiedSubscriptionStatus } from './verifiedBilling';
import { BillingSecurityError } from './verifiedBilling';
import type { ServerSession } from '../worker/sessions';
import { requireOwner } from '../worker/sessions';

const STATUSES = new Set<string>(['DONE','CANCELED','PARTIAL_CANCELED','ABORTED','EXPIRED']);
function mappedStatus(p: VerifiedPaymentStatus): VerifiedSubscriptionStatus {
  if (p==='DONE') return 'ACTIVE';
  if (p==='CANCELED' || p==='PARTIAL_CANCELED') return 'REFUNDED';
  return 'PAST_DUE';
}

export async function confirmTrustedPayment(
  orderId: string,
  paymentKey: string,
  session: ServerSession,
  opts: { ledger: BillingLedger; lookup: PaymentLookup; sandboxEnabled: boolean; mode: 'test'|'live' }
): Promise<{outcome: 'APPLIED'|'DUPLICATE'|'STALE'; status: VerifiedSubscriptionStatus}> {
  if (opts.mode!=='test' || !opts.sandboxEnabled) {
    throw new BillingSecurityError('LIVE_BILLING_DISABLED');
  }
  requireOwner(session);
  if (typeof orderId!=='string' || orderId.length<1 || orderId.length>180 ||
      typeof paymentKey!=='string' || paymentKey.length<1 || paymentKey.length>200) {
    throw new BillingSecurityError('INVALID_PAYMENT_REQUEST');
  }

  const order = await opts.ledger.findOrder(orderId);
  if (!order || order.tenantId!==session.tenantId ||
      !order.mId || !order.plan || !Number.isSafeInteger(order.amount) ||
      order.amount<=0 || !Number.isSafeInteger(order.periodStart) ||
      !Number.isSafeInteger(order.periodEnd) || order.periodEnd<=order.periodStart) {
    throw new BillingSecurityError('ORDER_NOT_FOUND_FOR_TENANT');
  }
  if (order.expectedPaymentKey && order.expectedPaymentKey !== paymentKey) {
    throw new BillingSecurityError('EXPECTED_PAYMENT_KEY_MISMATCH');
  }

  let payment;
  try {
    payment = await opts.lookup.getPayment(paymentKey);
  } catch {
    throw new BillingSecurityError('PAYMENT_LOOKUP_FAILED');
  }
  if (!payment ||
      payment.paymentKey!==paymentKey ||
      payment.orderId!==orderId ||
      payment.mId!==order.mId ||
      payment.totalAmount!==order.amount ||
      !STATUSES.has(payment.status)) {
    throw new BillingSecurityError('PROVIDER_PROOF_MISMATCH');
  }

  const eventKey='verified-api:' + crypto.createHash('sha256')
    .update(orderId+':'+paymentKey+':'+payment.status).digest('hex');
  const status = mappedStatus(payment.status);
  const outcome=await opts.ledger.applyVerified({
    eventKey, orderId, tenantId:order.tenantId, paymentKey,
    amount:order.amount, mId:order.mId,plan:order.plan,status,
    periodStart:order.periodStart,periodEnd:order.periodEnd,
    occurredAt:Date.now(),
  });
  if (!['APPLIED','DUPLICATE','STALE'].includes(outcome)) {
    throw new BillingSecurityError('LEDGER_REJECTED');
  }
  return { outcome, status };
}
