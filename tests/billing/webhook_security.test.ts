/**
 * ReturnWise Pro Webhook & Billing Security Contract Tests (tests/billing/webhook_security.test.ts)
 * Verifies webhook HMAC-SHA256 signature verification, idempotency deduplication,
 * out-of-order event handling, failure/cancel/refund entitlement revoke, sensitive log sanitization,
 * and reconciliation cron job.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 중복 webhook도 요금/권한 중복 없음 (Idempotent).
 * 2. 결제 성공 확인 없는 권한 부여 금지.
 * 3. 취소/환불 후 권한 회수(Revoke) 정책 일관.
 * 4. 결제 로그 내 카드정보/빌링키/시크릿 마스킹.
 * 5. 실결제는 서면 승인·사업자 설정 완료 후 (Sandbox 모드 강제).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  verifyWebhookSignature,
  handleTossWebhook,
  getSubscription,
  applySubscriptionUpdate,
  runBillingReconciliation,
  sanitizeBillingLog,
  saveSubscription,
  _resetBillingStore,
} from '../../server/billing/billingService';
import type { TossWebhookPayload } from '../../server/billing/types';

describe('T39 | Billing Webhook & Subscription Security Contract', () => {
  const secretKey = 'test_sk_mock_secret_key_12345';
  const tenantId = 'tenant_billing_test';

  beforeEach(() => {
    _resetBillingStore();
  });

  describe('1. 웹훅 HMAC-SHA256 서명 검증', () => {
    it('유효한 HMAC 서명은 검증을 통과해야 한다', () => {
      const payload = JSON.stringify({ eventType: 'PAYMENT_STATUS_CHANGED', data: { status: 'DONE' } });
      const signature = crypto.createHmac('sha256', secretKey).update(payload).digest('base64');

      assert.strictEqual(verifyWebhookSignature(payload, signature, secretKey), true);
    });

    it('위조되거나 불일치하는 서명은 즉각 거절되어야 한다', () => {
      const payload = JSON.stringify({ eventType: 'PAYMENT_STATUS_CHANGED', data: { status: 'DONE' } });
      const badSignature = 'invalid_signature_string';

      assert.strictEqual(verifyWebhookSignature(payload, badSignature, secretKey), false);
    });
  });

  describe('2. 결제 성공 검증 및 권한 부여 (No Grant Without Proof)', () => {
    it('결제 성공(DONE) 확인 시에만 ACTIVE 상태 및 Pro 플랜이 부여되어야 한다', () => {
      const payload: TossWebhookPayload = {
        eventType: 'PAYMENT_STATUS_CHANGED',
        createdAt: new Date().toISOString(),
        data: {
          paymentKey: 'pay_success_123',
          orderId: 'ord_123',
          status: 'DONE',
          totalAmount: 14900,
        },
      };

      const result = handleTossWebhook(payload, tenantId, 'PRO');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'ACTIVE');

      const sub = getSubscription(tenantId);
      assert.strictEqual(sub.status, 'ACTIVE');
      assert.strictEqual(sub.plan, 'PRO');
      assert.strictEqual(sub.lastPaymentKey, 'pay_success_123');
    });

    it('결제 실패(ABORTED) 시 권한이 부여되지 않고 PAST_DUE 로 전이되어야 한다', () => {
      const failPayload: TossWebhookPayload = {
        eventType: 'PAYMENT_STATUS_CHANGED',
        createdAt: new Date().toISOString(),
        data: {
          paymentKey: 'pay_fail_123',
          orderId: 'ord_fail_123',
          status: 'ABORTED',
          totalAmount: 14900,
        },
      };

      const result = handleTossWebhook(failPayload, tenantId, 'PRO');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'PAST_DUE');

      const sub = getSubscription(tenantId);
      assert.strictEqual(sub.status, 'PAST_DUE');
      assert.strictEqual(sub.plan, 'FREE'); // 권한 미부여
    });
  });

  describe('3. 멱등성 및 중복 웹훅 방어 (Idempotency)', () => {
    it('동일한 결제 성공 웹훅이 중복 수신되어도 상태 및 권한이 중복 연장되지 않아야 한다', () => {
      const payload: TossWebhookPayload = {
        eventType: 'PAYMENT_STATUS_CHANGED',
        createdAt: new Date().toISOString(),
        data: {
          paymentKey: 'pay_dup_123',
          orderId: 'ord_dup_123',
          status: 'DONE',
          totalAmount: 14900,
        },
      };

      // 1회차 수신
      const res1 = handleTossWebhook(payload, tenantId, 'PRO');
      assert.strictEqual(res1.status, 'ACTIVE');
      assert.strictEqual(res1.duplicateIgnored, undefined);

      // 2회차 중복 수신
      const res2 = handleTossWebhook(payload, tenantId, 'PRO');
      assert.strictEqual(res2.status, 'ACTIVE');
      assert.strictEqual(res2.duplicateIgnored, true);
    });
  });

  describe('4. 취소 및 환불 시 유료 권한 즉각 회수 (Entitlement Revoke)', () => {
    it('취소/환불(CANCELED) 웹훅 수신 시 상태가 REFUNDED 로 전이되고 플랜이 FREE 로 즉시 회수되어야 한다', () => {
      // 1. 먼저 정상 구독 활성화
      const payDone: TossWebhookPayload = {
        eventType: 'PAYMENT_STATUS_CHANGED',
        createdAt: new Date().toISOString(),
        data: { paymentKey: 'pay_refund_123', orderId: 'ord_r1', status: 'DONE', totalAmount: 14900 },
      };
      handleTossWebhook(payDone, tenantId, 'PRO');
      assert.strictEqual(getSubscription(tenantId).plan, 'PRO');

      // 2. 환불 웹훅 수신
      const payCancel: TossWebhookPayload = {
        eventType: 'PAYMENT_STATUS_CHANGED',
        createdAt: new Date().toISOString(),
        data: { paymentKey: 'pay_refund_123', orderId: 'ord_r1', status: 'CANCELED', totalAmount: 14900 },
      };
      const cancelRes = handleTossWebhook(payCancel, tenantId, 'PRO');
      assert.strictEqual(cancelRes.status, 'REFUNDED');

      // 3. 플랜이 FREE 로 회수되었는지 엄격 검증
      const revokedSub = getSubscription(tenantId);
      assert.strictEqual(revokedSub.status, 'REFUNDED');
      assert.strictEqual(revokedSub.plan, 'FREE');
    });
  });

  describe('5. 역순 이벤트(Out-of-order) 및 재조정 배치(Reconciliation)', () => {
    it('과거 시점의 이전 상태 이벤트가 최신 상태를 덮어쓰지 못하도록 방어해야 한다', () => {
      const now = Date.now();
      // 최신 시점(now)에 CANCELED 처리
      applySubscriptionUpdate(tenantId, 'CANCELED', now);

      // 과거 시점(now - 10000)의 ACTIVE 이벤트가 지연 도착한 경우 무시되어야 함
      const applied = applySubscriptionUpdate(tenantId, 'ACTIVE', now - 10000);
      assert.strictEqual(applied, false);
      assert.strictEqual(getSubscription(tenantId).status, 'CANCELED');
    });

    it('재조정 배치는 7일 이상 PAST_DUE 상태인 구독을 자동 CANCELED 처리하고 권한을 회수해야 한다', () => {
      const staleSub = getSubscription(tenantId);
      staleSub.status = 'PAST_DUE';
      staleSub.plan = 'STARTER';
      staleSub.updatedAt = Date.now() - 8 * 86400000; // 8일 전
      saveSubscription(staleSub);

      const jobResult = runBillingReconciliation();
      assert.strictEqual(jobResult.reconciledCount, 1);

      const reconciled = getSubscription(tenantId);
      assert.strictEqual(reconciled.status, 'CANCELED');
      assert.strictEqual(reconciled.plan, 'FREE');
    });
  });

  describe('6. 결제 로그 민감정보 마스킹 (Redaction)', () => {
    it('결제 로그 내 시크릿 키, 빌링 키, 카드 번호가 평문으로 노출되지 않고 마스킹되어야 한다', () => {
      const rawLog =
        'Payment processed with test_sk_abc123456789 and billing key bln_987654321 for card 1234-5678-9012-3456';
      const sanitized = sanitizeBillingLog(rawLog);

      assert.ok(!sanitized.includes('test_sk_abc123456789'));
      assert.ok(!sanitized.includes('bln_987654321'));
      assert.ok(!sanitized.includes('1234-5678-9012-3456'));
      assert.ok(sanitized.includes('[REDACTED_SECRET_KEY]'));
      assert.ok(sanitized.includes('[REDACTED_BILLING_KEY]'));
      assert.ok(sanitized.includes('[REDACTED_CARD_NUMBER]'));
    });
  });
});
