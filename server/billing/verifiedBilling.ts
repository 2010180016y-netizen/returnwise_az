/**
 * S2 synthetic signed-event test boundary only. NOT a production
 * PAYMENT_STATUS_CHANGED webhook handler: Toss does NOT sign that event family.
 * S3 authenticates paid status through server-initiated provider GET verification.
 * No HTTP route, paid action, or live key is enabled.
 *
 * Only test-mode processing is allowed until S3 implements a durable, atomic
 * Cloudflare D1 adapter, session isolation, and final human launch approval.
 */
import crypto from 'node:crypto';
import { verifyWebhookSignature } from './billingService';

export type VerifiedPaymentStatus = 'DONE' | 'CANCELED' | 'PARTIAL_CANCELED' | 'ABORTED' | 'EXPIRED';
export type VerifiedSubscriptionStatus = 'ACTIVE' | 'REFUNDED' | 'PAST_DUE';
export type PaidTier = 'STARTER' | 'PRO';

export interface BillingOrder {
  orderId: string;
  tenantId: string;
  mId: string;
  amount: number;
  plan: PaidTier;
  periodStart: number;
  periodEnd: number;
  expectedPaymentKey?: string;
}

export interface VerifiedProviderPayment {
  paymentKey: string;
  orderId: string;
  mId: string;
  totalAmount: number;
  status: VerifiedPaymentStatus;
}

export interface VerifiedCommit {
  eventKey: string;
  orderId: string;
  tenantId: string;
  paymentKey: string;
  amount: number;
  mId: string;
  plan: PaidTier;
  status: VerifiedSubscriptionStatus;
  periodStart: number;
  periodEnd: number;
  occurredAt: number;
}

export interface BillingLedger {
  /** Read an order that was created and priced exclusively on the server. */
  findOrder(orderId: string): Promise<BillingOrder | null>;
  /**
   * MUST atomically insert eventKey if absent, revalidate order binding,
   * deduplicate (orderId, paymentKey, status) irrespective of webhook eventId,
   * apply a non-regressing order/subscription transition, and commit together.
   * Never implement with independent read / write requests.
   * S3 owns the production D1 implementation and concurrency tests.
   */
  applyVerified(input: VerifiedCommit): Promise<'APPLIED' | 'DUPLICATE' | 'STALE'>;
}

export interface PaymentLookup {
  /** Trusted server-to-Toss payment lookup, never a client/webhook echo. */
  getPayment(paymentKey: string): Promise<VerifiedProviderPayment>;
}

export interface WebhookEnvelope {
  rawBody: string;
  signatureHeader: string;
  transmissionTime: string;
}

export interface S2BillingDependencies {
  webhookSecurityKey: string; // Toss webhook security key, NOT API secret key
  lookup: PaymentLookup;
  ledger: BillingLedger;
  mode: 'test' | 'live';
  /** Explicit opt-in for local or CI simulation only. */
  sandboxEnabled: boolean;
}

export interface BillingProcessResult {
  outcome: 'APPLIED' | 'DUPLICATE' | 'STALE';
  status: VerifiedSubscriptionStatus;
}

export class BillingSecurityError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'BillingSecurityError';
  }
}

interface PaymentNotification {
  eventType: 'PAYMENT_STATUS_CHANGED';
  createdAt: string;
  eventId?: string;
  data: {
    paymentKey: string;
    orderId: string;
    totalAmount: number;
    status: VerifiedPaymentStatus;
  };
}

const KNOWN_STATUSES = new Set<string>(['DONE', 'CANCELED', 'PARTIAL_CANCELED', 'ABORTED', 'EXPIRED']);
const MAX_BODY_BYTES = 64 * 1024;

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function parseNotification(rawBody: string): PaymentNotification {
  let obj: unknown;
  try {
    obj = JSON.parse(rawBody);
  } catch {
    throw new BillingSecurityError('INVALID_JSON');
  }
  if (!isRecord(obj) || obj.eventType !== 'PAYMENT_STATUS_CHANGED' || !isRecord(obj.data)) {
    throw new BillingSecurityError('UNSUPPORTED_EVENT');
  }
  const data = obj.data;
  if (
    typeof data.paymentKey !== 'string' || data.paymentKey.length === 0 ||
    typeof data.orderId !== 'string' || data.orderId.length === 0 ||
    !Number.isSafeInteger(data.totalAmount) || (data.totalAmount as number) <= 0 ||
    typeof data.status !== 'string' || !KNOWN_STATUSES.has(data.status) ||
    typeof obj.createdAt !== 'string' || !Number.isFinite(Date.parse(obj.createdAt)) ||
    (obj.eventId !== undefined && (typeof obj.eventId !== 'string' || obj.eventId.length === 0))
  ) {
    throw new BillingSecurityError('INVALID_EVENT_BODY');
  }
  return obj as unknown as PaymentNotification;
}

function desiredStatus(s: VerifiedPaymentStatus): VerifiedSubscriptionStatus {
  if (s === 'DONE') return 'ACTIVE';
  if (s === 'CANCELED' || s === 'PARTIAL_CANCELED') return 'REFUNDED';
  return 'PAST_DUE';
}

/**
 * Callable only via a deliberate server-side, test-mode adapter.
 * All authority comes from the server-stored order and independent lookup.
 */
export async function processVerifiedBillingWebhook(
  envelope: WebhookEnvelope,
  deps: S2BillingDependencies
): Promise<BillingProcessResult> {
  if (deps.mode !== 'test' || !deps.sandboxEnabled) {
    throw new BillingSecurityError('LIVE_BILLING_DISABLED');
  }
  if (
    typeof envelope.rawBody !== 'string' ||
    Buffer.byteLength(envelope.rawBody, 'utf8') > MAX_BODY_BYTES
  ) {
    throw new BillingSecurityError('BODY_TOO_LARGE');
  }
  if (!verifyWebhookSignature(
    envelope.rawBody, envelope.signatureHeader, envelope.transmissionTime, deps.webhookSecurityKey
  )) {
    throw new BillingSecurityError('INVALID_WEBHOOK_SIGNATURE');
  }

  const event = parseNotification(envelope.rawBody);
  const order = await deps.ledger.findOrder(event.data.orderId);
  if (!order || !order.tenantId || !order.orderId || !order.mId ||
      !Number.isSafeInteger(order.amount) || order.amount <= 0 ||
      !Number.isSafeInteger(order.periodStart) || !Number.isSafeInteger(order.periodEnd) ||
      order.periodEnd <= order.periodStart ||
      !['STARTER', 'PRO'].includes(order.plan)) {
    throw new BillingSecurityError('UNKNOWN_OR_INVALID_ORDER');
  }

  if (event.data.totalAmount !== order.amount) {
    throw new BillingSecurityError('ORDER_AMOUNT_MISMATCH');
  }

  // A webhook alone is NEVER sufficient evidence of paid status.
  let payment: VerifiedProviderPayment;
  try {
    payment = await deps.lookup.getPayment(event.data.paymentKey);
  } catch {
    throw new BillingSecurityError('PAYMENT_LOOKUP_FAILED');
  }

  if (!payment ||
      payment.paymentKey !== event.data.paymentKey ||
      payment.orderId !== order.orderId ||
      payment.mId !== order.mId ||
      payment.totalAmount !== order.amount ||
      payment.totalAmount !== event.data.totalAmount ||
      (order.expectedPaymentKey !== undefined && order.expectedPaymentKey !== payment.paymentKey) ||
      !KNOWN_STATUSES.has(payment.status)) {
    throw new BillingSecurityError('PAYMENT_PROOF_MISMATCH');
  }
  // An out-of-order webhook must never reactivate a refunded subscription.
  // Reconcile separately against the current provider payment record.
  if (event.data.status !== payment.status) {
    throw new BillingSecurityError('STALE_WEBHOOK_STATUS');
  }

  const eventKey = event.eventId
    ? 'event:' + event.eventId
    : 'payment:' + crypto.createHash('sha256')
      .update([event.eventType, event.createdAt, payment.paymentKey, payment.status].join(':'))
      .digest('hex');

  const commit: VerifiedCommit = {
    eventKey,
    orderId: order.orderId,
    tenantId: order.tenantId,
    paymentKey: payment.paymentKey,
    amount: order.amount,
    mId: order.mId,
    plan: order.plan,
    status: desiredStatus(payment.status),
    periodStart: order.periodStart,
    periodEnd: order.periodEnd,
    occurredAt: Date.parse(event.createdAt),
  };

  // Ledger must enforce dedup, forward-only transitions and entitlement
  // atomically in S3; this test-mode boundary never writes client-owned state.
  const outcome = await deps.ledger.applyVerified(commit);
  if (!['APPLIED', 'DUPLICATE', 'STALE'].includes(outcome)) {
    throw new BillingSecurityError('LEDGER_REJECTED');
  }
  return { outcome, status: commit.status };
}
