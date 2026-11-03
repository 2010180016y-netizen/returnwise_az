/**
 * ReturnWise Pro Billing Service & Webhook Handler (server/billing/billingService.ts)
 * Enforces webhook HMAC-SHA256 signature verification, idempotency deduplication,
 * out-of-order handling, entitlement revoke on cancel/refund, and sensitive logging redaction.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 결제 성공 확인 없는 권한 부여 금지.
 * 2. 중복 webhook 수신 시에도 요금/권한 중복 없음 (Idempotent).
 * 3. 취소/환불 시 유료 권한(Entitlement) 즉각 회수.
 * 4. 로그 내 카드정보/빌링키/시크릿 마스킹.
 * 5. 실결제는 서면 승인·사업자 설정 완료 후 (Sandbox 모드 강제).
 */

import crypto from 'crypto';
import type { SubscriptionRecord, SubscriptionStatus, TossWebhookPayload, WebhookResult } from './types';

// In-memory subscription store for Cloudflare Workers / D1 mock
const subscriptions: Map<string, SubscriptionRecord> = new Map();
const processedWebhookEvents: Set<string> = new Set();

/**
 * Redacts sensitive credentials from log output
 */
export function sanitizeBillingLog(message: string): string {
  return message
    .replace(/test_sk_[a-zA-Z0-9_-]+/g, '[REDACTED_SECRET_KEY]')
    .replace(/live_sk_[a-zA-Z0-9_-]+/g, '[REDACTED_SECRET_KEY]')
    .replace(/bln_[a-zA-Z0-9_-]+/g, '[REDACTED_BILLING_KEY]')
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED_CARD_NUMBER]');
}

/**
 * Verifies Toss Payments Webhook Signature (HMAC-SHA256)
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secretKey: string
): boolean {
  if (!rawBody || !signatureHeader || !secretKey) {
    return false;
  }
  const expected = crypto.createHmac('sha256', secretKey).update(rawBody).digest('base64');
  const sigBuf = Buffer.from(signatureHeader);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export function getSubscription(tenantId: string): SubscriptionRecord {
  const sub = subscriptions.get(tenantId);
  if (!sub) {
    return {
      tenantId,
      plan: 'FREE',
      status: 'UNPAID',
      currentPeriodStart: Date.now(),
      currentPeriodEnd: Date.now() + 30 * 86400000,
      cancelAtPeriodEnd: false,
      failedAttempts: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
  return { ...sub };
}

export function saveSubscription(sub: SubscriptionRecord): void {
  subscriptions.set(sub.tenantId, {
    ...sub,
  });
}

/**
 * Processes Toss Webhook Event idempotently and safely
 */
export function handleTossWebhook(
  payload: TossWebhookPayload,
  tenantId: string,
  plan: 'STARTER' | 'PRO' = 'PRO'
): WebhookResult {
  const eventId = `${payload.eventType}_${payload.data.paymentKey}_${payload.data.status}`;

  // 1. Idempotency Check: Already processed?
  if (processedWebhookEvents.has(eventId)) {
    const current = getSubscription(tenantId);
    return {
      success: true,
      message: 'Duplicate webhook event ignored safely.',
      status: current.status,
      duplicateIgnored: true,
    };
  }

  const sub = getSubscription(tenantId);

  // 2. Handle Payment Status
  switch (payload.data.status) {
    case 'DONE': {
      // 결제 성공 검증: 결제 성공이 확인된 경우에만 ACTIVE 및 유료 플랜 권한 부여
      sub.plan = plan;
      sub.status = 'ACTIVE';
      sub.lastPaymentKey = payload.data.paymentKey;
      sub.failedAttempts = 0;
      sub.currentPeriodStart = Date.now();
      sub.currentPeriodEnd = Date.now() + 30 * 86400000;
      sub.updatedAt = Date.now();
      saveSubscription(sub);
      processedWebhookEvents.add(eventId);
      return { success: true, message: 'Subscription activated', status: 'ACTIVE' };
    }

    case 'CANCELED':
    case 'PARTIAL_CANCELED': {
      // 취소/환불 시 유료 권한(Entitlement) 즉각 회수
      sub.status = 'REFUNDED';
      sub.plan = 'FREE'; // 즉각 무료 권한으로 회수 (Revoke)
      sub.updatedAt = Date.now();
      saveSubscription(sub);
      processedWebhookEvents.add(eventId);
      return { success: true, message: 'Subscription refunded and entitlement revoked', status: 'REFUNDED' };
    }

    case 'ABORTED':
    case 'EXPIRED': {
      // 결제 실패/중단 시 PAST_DUE 전이 및 재시도 카운트 증가
      sub.failedAttempts += 1;
      if (sub.failedAttempts >= 3) {
        sub.status = 'CANCELED';
        sub.plan = 'FREE'; // 최종 해지 및 권한 회수
      } else {
        sub.status = 'PAST_DUE';
      }
      sub.updatedAt = Date.now();
      saveSubscription(sub);
      processedWebhookEvents.add(eventId);
      return { success: true, message: `Payment failed, status set to ${sub.status}`, status: sub.status };
    }

    default:
      return { success: false, message: 'Unknown payment status', status: sub.status };
  }
}

/**
 * Out-of-order event guard: prevents older events from overriding newer state
 */
export function applySubscriptionUpdate(
  tenantId: string,
  newStatus: SubscriptionStatus,
  eventTimestamp: number
): boolean {
  const sub = getSubscription(tenantId);
  if (sub.updatedAt > eventTimestamp) {
    // Newer state already exists, ignore out-of-order event
    return false;
  }
  sub.status = newStatus;
  sub.updatedAt = eventTimestamp;
  if (newStatus === 'CANCELED' || newStatus === 'REFUNDED') {
    sub.plan = 'FREE';
  }
  saveSubscription(sub);
  return true;
}

/**
 * Periodic reconciliation job (장애 재조정 동기화 배치)
 * Recovers desynchronized subscriptions after webhook delivery outage
 */
export function runBillingReconciliation(): { reconciledCount: number } {
  let count = 0;
  const now = Date.now();

  for (const sub of subscriptions.values()) {
    // If subscription is PAST_DUE for more than 7 days, auto-cancel
    if (sub.status === 'PAST_DUE' && now - sub.updatedAt > 7 * 86400000) {
      sub.status = 'CANCELED';
      sub.plan = 'FREE';
      sub.updatedAt = now;
      subscriptions.set(sub.tenantId, sub);
      count += 1;
    }
  }

  return { reconciledCount: count };
}

/**
 * Resets state for tests
 */
export function _resetBillingStore(): void {
  subscriptions.clear();
  processedWebhookEvents.clear();
}
