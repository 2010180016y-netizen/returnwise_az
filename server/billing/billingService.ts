/**
 * Toss Payments webhook signature helper for SIGNED payout/seller events ONLY.
 * WARNING: PAYMENT_STATUS_CHANGED does not include this signature header.\n * Never use this helper as a production payment-status authentication gate.\n * Docs: https://docs.tosspayments.com/reference/using-api/webhook-events
 *
 * HMAC SHA-256(UTF8(rawBody + ':' + transmissionTime), webhook SECURITY key).
 * A valid header has one or more comma-separated 'v1:<base64>' values.
 * The transmission id is NOT a deduplication key.
 */
import crypto from 'node:crypto';

const SIGNATURE_PREFIX = 'v1:';
const MAX_HEADER_LENGTH = 16 * 1024;

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  transmissionTime: string,
  securityKey: string
): boolean {
  if (!rawBody || !signatureHeader || !transmissionTime || !securityKey) return false;
  if (signatureHeader.length > MAX_HEADER_LENGTH) return false;

  const expected = crypto
    .createHmac('sha256', securityKey)
    .update(rawBody + ':' + transmissionTime, 'utf8')
    .digest();

  let valid = false;
  for (const part of signatureHeader.split(',')) {
    const token = part.trim();
    if (!token.startsWith(SIGNATURE_PREFIX)) continue;
    const b64 = token.slice(SIGNATURE_PREFIX.length);
    if (!/^[A-Za-z0-9+/]{43}=$/.test(b64)) continue;
    const decoded = Buffer.from(b64, 'base64');
    if (decoded.length === expected.length && crypto.timingSafeEqual(decoded, expected)) {
      valid = true;
    }
  }
  return valid;
}

export function sanitizeBillingLog(message: string): string {
  return message
    .replace(/(?:test|live)_(?:g?sk)_[a-zA-Z0-9_-]+/g, '[REDACTED_SECRET_KEY]')
    .replace(/bln_[a-zA-Z0-9_-]+/g, '[REDACTED_BILLING_KEY]')
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED_CARD_NUMBER]');
}
