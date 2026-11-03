import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  verifyWebhookSignature, sanitizeBillingLog,
} from '../../server/billing/billingService';
import {
  processVerifiedBillingWebhook, BillingSecurityError,
} from '../../server/billing/verifiedBilling';
import type {
  BillingLedger, BillingOrder, PaymentLookup, VerifiedProviderPayment,
  VerifiedCommit, S2BillingDependencies,
} from '../../server/billing/verifiedBilling';
import { createTestTossPaymentLookup } from '../../server/billing/tossPaymentLookup';

const securityKey = 'webhook_security_key_for_test_only';
const transmissionTime = '2026-11-03T04:30:00.000Z';
const order: BillingOrder = {
  orderId: 'order_s2_001',
  tenantId: 'tenant_original',
  mId: 'tosspayments_test_mid_001',
  amount: 14900,
  plan: 'PRO',
  periodStart: Date.parse('2026-11-03T00:00:00Z'),
  periodEnd: Date.parse('2026-12-03T00:00:00Z'),
};
const providerPayment: VerifiedProviderPayment = {
  paymentKey: 'payment_s2_001',
  orderId: order.orderId,
  totalAmount: order.amount,
  mId: order.mId,
  status: 'DONE',
};
const eventBase = {
  eventType: 'PAYMENT_STATUS_CHANGED',
  createdAt: '2026-11-03T04:30:00Z',
  data: {
    paymentKey: providerPayment.paymentKey,
    orderId: order.orderId,
    totalAmount: order.amount,
    status: 'DONE',
  },
};

function envelope(body: unknown = eventBase, key = securityKey, time = transmissionTime) {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
  const b64 = crypto.createHmac('sha256', key)
    .update(rawBody + ':' + time).digest('base64');
  return { rawBody, signatureHeader: 'v1:' + b64, transmissionTime: time };
}

class MemoryLedger implements BillingLedger {
  orders: Map<string, BillingOrder> = new Map([[order.orderId, { ...order }]]);
  events = new Set<string>();
  commits: VerifiedCommit[] = [];
  async findOrder(id: string) {
    return this.orders.get(id) ?? null;
  }
  async applyVerified(commit: VerifiedCommit): Promise<'APPLIED' | 'DUPLICATE' | 'STALE'> {
    if (this.events.has(commit.eventKey)) return 'DUPLICATE';
    const prior = this.commits.filter(x => x.orderId === commit.orderId).at(-1);
    if (prior && (prior.occurredAt > commit.occurredAt ||
      (prior.status === 'REFUNDED' && commit.status === 'ACTIVE'))) return 'STALE';
    // Atomic in-memory test double only. S3 must implement an actual D1 transaction.
    this.events.add(commit.eventKey);
    this.commits.push(commit);
    return 'APPLIED';
  }
}

function testDeps(overrides: Partial<S2BillingDependencies> = {}) {
  const ledger = new MemoryLedger();
  const lookup: PaymentLookup = {
    getPayment: async () => ({ ...providerPayment }),
  };
  const deps: S2BillingDependencies = {
    webhookSecurityKey: securityKey, lookup, ledger, mode: 'test',
    sandboxEnabled: true, ...overrides,
  };
  return { ledger, deps };
}

async function rejectsCode(operation: Promise<unknown>, code: string) {
  await assert.rejects(operation, (e: unknown) =>
    e instanceof BillingSecurityError && e.code === code
  );
}

describe('S2 | official Toss webhook HMAC verification', () => {
  it('verifies raw payload + colon + transmission time with webhook SECURITY key', () => {
    const signed = envelope();
    assert.equal(verifyWebhookSignature(
      signed.rawBody, signed.signatureHeader, signed.transmissionTime, securityKey
    ), true);
  });

  it('accepts one of several v1 signatures during key rotation', () => {
    const signed = envelope();
    assert.equal(verifyWebhookSignature(signed.rawBody,
      'v1:' + Buffer.alloc(32, 3).toString('base64') + ', ' + signed.signatureHeader,
      signed.transmissionTime, securityKey), true);
  });

  it('rejects changed payload, time, key and unknown signature versions', () => {
    const signed = envelope();
    assert.equal(verifyWebhookSignature(
      signed.rawBody + ' ', signed.signatureHeader, signed.transmissionTime, securityKey
    ), false);
    assert.equal(verifyWebhookSignature(
      signed.rawBody, signed.signatureHeader, signed.transmissionTime + 'x', securityKey
    ), false);
    assert.equal(verifyWebhookSignature(
      signed.rawBody, signed.signatureHeader, signed.transmissionTime, 'other'
    ), false);
    assert.equal(verifyWebhookSignature(
      signed.rawBody, signed.signatureHeader.replace('v1:', 'v2:'),
      signed.transmissionTime, securityKey
    ), false);
    assert.equal(verifyWebhookSignature(
      signed.rawBody, 'v1:bad-base64!', signed.transmissionTime, securityKey
    ), false);
  });

  it('rejects missing signature components and overlong header', () => {
    const signed = envelope();
    assert.equal(verifyWebhookSignature(signed.rawBody, '', signed.transmissionTime, securityKey), false);
    assert.equal(verifyWebhookSignature(signed.rawBody, 'v1:' + 'x'.repeat(17000), signed.transmissionTime, securityKey), false);
  });

  it('redacts API secrets, billing key and card number', () => {
    const s = sanitizeBillingLog('test_sk_demo live_sk_demo test_gsk_demo bln_abcde 1234-5678-9012-3456');
    assert.ok(!s.includes('test_sk_demo'));
    assert.ok(!s.includes('live_sk_demo'));
    assert.ok(!s.includes('test_gsk_demo'));
    assert.ok(!s.includes('bln_abcde'));
    assert.ok(!s.includes('1234-5678-9012-3456'));
  });
});

describe('S2 | trusted payment / merchant / order / tenant binding', () => {
  it('grants only the server-side stored plan and tenant after independently verified DONE', async () => {
    const { ledger, deps } = testDeps();
    const res = await processVerifiedBillingWebhook(envelope(), deps);
    assert.equal(res.outcome, 'APPLIED');
    assert.equal(res.status, 'ACTIVE');
    assert.equal(ledger.commits.length, 1);
    assert.equal(ledger.commits[0].tenantId, 'tenant_original');
    assert.equal(ledger.commits[0].plan, 'PRO');
    assert.equal(ledger.commits[0].amount, 14900);
  });

  it('duplicates produce no second grant and no changed subscription period', async () => {
    const { ledger, deps } = testDeps();
    const signed = envelope();
    assert.equal((await processVerifiedBillingWebhook(signed, deps)).outcome, 'APPLIED');
    assert.equal((await processVerifiedBillingWebhook(signed, deps)).outcome, 'DUPLICATE');
    assert.equal(ledger.commits.length, 1);
    assert.equal(ledger.commits[0].periodEnd, order.periodEnd);
  });

  it('rejects invalid signatures before any provider request or datastore access', async () => {
    let calls = 0;
    const { deps } = testDeps({
      lookup: { getPayment: async () => { calls++; return providerPayment; } },
    });
    const e = envelope();
    e.signatureHeader = 'v1:' + Buffer.alloc(32).toString('base64');
    await rejectsCode(processVerifiedBillingWebhook(e, deps), 'INVALID_WEBHOOK_SIGNATURE');
    assert.equal(calls, 0);
  });

  it('does not allow test code to activate LIVE billing without S3/live approval', async () => {
    const { deps } = testDeps({ mode: 'live' });
    await rejectsCode(processVerifiedBillingWebhook(envelope(), deps), 'LIVE_BILLING_DISABLED');
    const { deps: off } = testDeps({ sandboxEnabled: false });
    await rejectsCode(processVerifiedBillingWebhook(envelope(), off), 'LIVE_BILLING_DISABLED');
  });

  it('rejects unknown order and webhook-order amount mismatch', async () => {
    const { deps, ledger } = testDeps();
    ledger.orders.clear();
    await rejectsCode(processVerifiedBillingWebhook(envelope(), deps), 'UNKNOWN_OR_INVALID_ORDER');
    ledger.orders.set(order.orderId, order);
    await rejectsCode(processVerifiedBillingWebhook(envelope({
      ...eventBase, data: { ...eventBase.data, totalAmount: 9900 },
    }), deps), 'ORDER_AMOUNT_MISMATCH');
  });

  for (const [label, mismatch] of [
    ['orderId', { orderId: 'another_order' }],
    ['merchant', { mId: 'different_merchant' }],
    ['amount', { totalAmount: 100 }],
    ['paymentKey', { paymentKey: 'forged_payment_key' }],
  ] as const) {
    it('blocks independently queried ' + label + ' mismatch', async () => {
      const { ledger, deps } = testDeps({
        lookup: { getPayment: async () => ({ ...providerPayment, ...mismatch }) },
      });
      await rejectsCode(processVerifiedBillingWebhook(envelope(), deps), 'PAYMENT_PROOF_MISMATCH');
      assert.equal(ledger.commits.length, 0);
    });
  }

  it('blocks unrecognized future or stale payment status without granting access', async () => {
    const { ledger, deps } = testDeps({
      lookup: { getPayment: async () => ({ ...providerPayment, status: 'CANCELED' }) },
    });
    await rejectsCode(processVerifiedBillingWebhook(envelope(), deps), 'STALE_WEBHOOK_STATUS');
    assert.equal(ledger.commits.length, 0);
  });

  it('does not trust caller-supplied tenant, merchant or plan fields', async () => {
    const { ledger, deps } = testDeps();
    const crafted = {
      ...eventBase, tenantId: 'attacker', plan: 'PRO', mId: 'malicious_mid',
    };
    await processVerifiedBillingWebhook(envelope(crafted), deps);
    assert.equal(ledger.commits[0].tenantId, order.tenantId);
    assert.equal(ledger.commits[0].mId, order.mId);
  });

  it('refuses provider lookup outage without a single commit', async () => {
    const { ledger, deps } = testDeps({
      lookup: { getPayment: async () => { throw new Error('timeout'); } },
    });
    await rejectsCode(processVerifiedBillingWebhook(envelope(), deps), 'PAYMENT_LOOKUP_FAILED');
    assert.equal(ledger.commits.length, 0);
  });

  it('rejects unknown event type, invalid body and malformed JSON', async () => {
    const { deps } = testDeps();
    await rejectsCode(processVerifiedBillingWebhook(envelope(
      { ...eventBase, eventType: 'BILLING_KEY_DELETED' }
    ), deps), 'UNSUPPORTED_EVENT');
    await rejectsCode(processVerifiedBillingWebhook(envelope('{oops'), deps), 'INVALID_JSON');
    await rejectsCode(processVerifiedBillingWebhook(envelope(
      { ...eventBase, data: { ...eventBase.data, totalAmount: -1 } }
    ), deps), 'INVALID_EVENT_BODY');
  });

  it('reconciles CANCEL and PARTIAL_CANCELED as no paid entitlement', async () => {
    for (const status of ['CANCELED', 'PARTIAL_CANCELED'] as const) {
      const { ledger, deps } = testDeps({
        lookup: { getPayment: async () => ({ ...providerPayment, status }) },
      });
      const payload = { ...eventBase, data: { ...eventBase.data, status } };
      const res = await processVerifiedBillingWebhook(envelope(payload), deps);
      assert.equal(res.status, 'REFUNDED');
      assert.equal(ledger.commits[0].status, 'REFUNDED');
    }
  });

  it('prevents delayed DONE from overriding refund state in atomic ledger contract', async () => {
    const { ledger, deps } = testDeps();
    const canceled = { ...eventBase, data: { ...eventBase.data, status: 'CANCELED' }, createdAt: '2026-11-03T04:31:00Z' };
    const newerDeps = {
      ...deps,
      lookup: { getPayment: async () => ({ ...providerPayment, status: 'CANCELED' as const }) },
    };
    await processVerifiedBillingWebhook(envelope(canceled), newerDeps);
    const later = await processVerifiedBillingWebhook(envelope(), deps);
    assert.equal(later.outcome, 'STALE');
    assert.equal(ledger.commits.length, 1);
  });

  it('rejects oversized raw webhook before parsing', async () => {
    const { deps } = testDeps();
    await rejectsCode(
      processVerifiedBillingWebhook(envelope(' '.repeat(70000)), deps), 'BODY_TOO_LARGE'
    );
  });
});

describe('S2 | Toss server-side test-key payment lookup adapter', () => {
  it('does not accept live keys or live mode', () => {
    assert.throws(() => createTestTossPaymentLookup({
      mode: 'live', apiSecretKey: 'live_sk_do_not_use',
    }), /LIVE_BILLING_DISABLED/);
    assert.throws(() => createTestTossPaymentLookup({
      mode: 'test', apiSecretKey: 'live_sk_do_not_use',
    }), /LIVE_BILLING_DISABLED/);
  });

  it('makes only a GET to fixed HTTPS Toss endpoint and checks response structure', async () => {
    let called = 0;
    const lookup = createTestTossPaymentLookup({
      mode: 'test',
      apiSecretKey: 'test_sk_fake_test_only',
      fetchImpl: async (url, init) => {
        called++;
        assert.equal(url, 'https://api.tosspayments.com/v1/payments/payment_s2_001');
        assert.equal(init?.method, 'GET');
        assert.equal(init?.redirect, 'error');
        assert.ok((init?.headers as Record<string, string>).Authorization.startsWith('Basic '));
        return new Response(JSON.stringify(providerPayment), { status: 200 });
      },
    });
    assert.deepEqual(await lookup.getPayment('payment_s2_001'), providerPayment);
    assert.equal(called, 1);
  });
});
