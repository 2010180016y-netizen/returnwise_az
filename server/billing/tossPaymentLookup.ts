/**
 * Server-only Toss Payments payment lookup.
 * Docs: https://docs.tosspayments.com/reference
 * Never import this file from React/client code or expose API secrets to browser.
 *
 * S2 keeps LIVE requests disabled. S3 will attach a durable repository/worker.
 */
import type { PaymentLookup, VerifiedProviderPayment, VerifiedPaymentStatus } from './verifiedBilling';

interface TossLookupSettings {
  apiSecretKey: string;
  mode: 'test' | 'live';
  fetchImpl?: typeof fetch;
}

const STATUSES = new Set<string>(['DONE', 'CANCELED', 'PARTIAL_CANCELED', 'ABORTED', 'EXPIRED']);

function readPayment(value: unknown): VerifiedProviderPayment {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_PAYMENT_RESPONSE');
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.paymentKey !== 'string' ||
      typeof obj.orderId !== 'string' ||
      typeof obj.mId !== 'string' ||
      !Number.isSafeInteger(obj.totalAmount) ||
      typeof obj.status !== 'string' ||
      !STATUSES.has(obj.status)) {
    throw new Error('INVALID_PAYMENT_RESPONSE');
  }
  return {
    paymentKey: obj.paymentKey,
    orderId: obj.orderId,
    mId: obj.mId,
    totalAmount: obj.totalAmount as number,
    status: obj.status as VerifiedPaymentStatus,
  };
}

export function createTestTossPaymentLookup(settings: TossLookupSettings): PaymentLookup {
  if (settings.mode !== 'test' || !/^test_(?:g?sk)_/.test(settings.apiSecretKey)) {
    throw new Error('LIVE_BILLING_DISABLED');
  }
  const callFetch = settings.fetchImpl ?? fetch;
  const auth = 'Basic ' + Buffer.from(settings.apiSecretKey + ':').toString('base64');

  return {
    async getPayment(paymentKey: string): Promise<VerifiedProviderPayment> {
      if (!paymentKey || paymentKey.length > 200) throw new Error('INVALID_PAYMENT_KEY');
      const response = await callFetch(
        'https://api.tosspayments.com/v1/payments/' + encodeURIComponent(paymentKey),
        {
          method: 'GET',
          headers: { Authorization: auth, Accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
          redirect: 'error',
        }
      );
      if (!response.ok) throw new Error('PAYMENT_LOOKUP_HTTP_ERROR');
      return readPayment(await response.json());
    },
  };
}
