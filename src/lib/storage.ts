/**
 * ReturnWise Local Storage Management Module (src/lib/storage.ts)
 * Secure, selective localStorage for non-sensitive operational defaults only.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. Auto-save default MUST BE OFF (explicit user consent required).
 * 2. Absolutely NO refund amounts (refundAmount, agreedPartialRefund) or customer data.
 * 3. TTL: 90 days expiration.
 * 4. Graceful fallback when storage is blocked (e.g. Private Browsing).
 */

export const STORAGE_KEY = 'rw_seller_defaults_v1';
export const CURRENT_SCHEMA_VERSION = 1;
export const TTL_DAYS = 90;
export const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

export interface NonSensitiveDefaults {
  reverseShippingSellerCost?: number;
  handlingCost?: number;
  replacementOutboundShipping?: number;
  platform?: 'NAVER' | 'COUPANG' | 'INDEPENDENT' | 'OTHER';
}

export interface StoragePayload {
  schemaVersion: number;
  savedAt: number; // Unix timestamp in ms
  expiresAt: number; // Unix timestamp in ms
  defaults: NonSensitiveDefaults;
}

/**
 * Checks whether localStorage is supported and accessible in the current environment.
 */
export function isStorageAvailable(): boolean {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return false;
  }
  try {
    const testKey = '__rw_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates and filters input into non-sensitive defaults only.
 * Rejects any transaction-specific or customer fields (e.g., refundAmount, orderId).
 */
export function sanitizeDefaults(input: Record<string, unknown>): NonSensitiveDefaults {
  const sanitized: NonSensitiveDefaults = {};

  if (typeof input.reverseShippingSellerCost === 'number' && Number.isFinite(input.reverseShippingSellerCost)) {
    if (input.reverseShippingSellerCost >= 0 && input.reverseShippingSellerCost <= 1_000_000_000) {
      sanitized.reverseShippingSellerCost = Math.floor(input.reverseShippingSellerCost);
    }
  }

  if (typeof input.handlingCost === 'number' && Number.isFinite(input.handlingCost)) {
    if (input.handlingCost >= 0 && input.handlingCost <= 1_000_000_000) {
      sanitized.handlingCost = Math.floor(input.handlingCost);
    }
  }

  if (typeof input.replacementOutboundShipping === 'number' && Number.isFinite(input.replacementOutboundShipping)) {
    if (input.replacementOutboundShipping >= 0 && input.replacementOutboundShipping <= 1_000_000_000) {
      sanitized.replacementOutboundShipping = Math.floor(input.replacementOutboundShipping);
    }
  }

  if (
    input.platform === 'NAVER' ||
    input.platform === 'COUPANG' ||
    input.platform === 'INDEPENDENT' ||
    input.platform === 'OTHER'
  ) {
    sanitized.platform = input.platform;
  }

  return sanitized;
}

/**
 * Saves non-sensitive operational defaults to localStorage.
 * STRICT: Returns false and writes 0 bytes unless explicitUserConsent is true.
 */
export function saveDefaults(
  defaults: NonSensitiveDefaults,
  explicitUserConsent: boolean
): boolean {
  // SPECIAL SAFETY CONDITION: Auto-save default MUST BE OFF
  if (!explicitUserConsent) {
    return false;
  }

  if (!isStorageAvailable()) {
    return false;
  }

  try {
    const sanitized = sanitizeDefaults(defaults as unknown as Record<string, unknown>);

    const now = Date.now();
    const payload: StoragePayload = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      savedAt: now,
      expiresAt: now + TTL_MS,
      defaults: sanitized,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error('Failed to save defaults to localStorage:', err);
    return false;
  }
}

/**
 * Loads saved non-sensitive defaults from localStorage.
 * Performs schema validation, TTL expiry check, and sanitization.
 */
export function loadSavedDefaults(): NonSensitiveDefaults | null {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoragePayload>;

    // Schema version validation & migration check
    if (!parsed || typeof parsed !== 'object' || parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      // Outdated or corrupted schema: clear and return null
      clearSavedDefaults();
      return null;
    }

    // TTL 90-day expiration check
    const now = Date.now();
    if (typeof parsed.expiresAt !== 'number' || now > parsed.expiresAt) {
      // Expired: clear and return null
      clearSavedDefaults();
      return null;
    }

    if (!parsed.defaults || typeof parsed.defaults !== 'object') {
      clearSavedDefaults();
      return null;
    }

    return sanitizeDefaults(parsed.defaults as Record<string, unknown>);
  } catch {
    // Malformed JSON or read error: clear and return null
    clearSavedDefaults();
    return null;
  }
}

/**
 * Completely clears saved defaults from localStorage.
 */
export function clearSavedDefaults(): boolean {
  if (!isStorageAvailable()) {
    return true;
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks whether valid, non-expired defaults currently exist in localStorage.
 */
export function hasSavedDefaults(): boolean {
  const loaded = loadSavedDefaults();
  return loaded !== null && Object.keys(loaded).length > 0;
}
