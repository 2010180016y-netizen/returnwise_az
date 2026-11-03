import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveDefaults,
  loadSavedDefaults,
  clearSavedDefaults,
  hasSavedDefaults,
  sanitizeDefaults,
  STORAGE_KEY,
  CURRENT_SCHEMA_VERSION,
  TTL_MS,
  NonSensitiveDefaults,
} from '../../src/lib/storage';

// In-memory mock for localStorage in Node environment
class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }
}

describe('T16 | Selective Local Storage & Privacy Contract', () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    // Attach to global window
    (global as unknown as { window: { localStorage: MockLocalStorage } }).window = {
      localStorage: mockStorage,
    };
  });

  describe('1. 명시적 체크 전 저장 0건 (특별 안전조건: 자동 저장 기본값 OFF)', () => {
    it('사용자의 명시적 동의(explicitUserConsent = false)가 없으면 어떤 데이터도 저장되지 않아야 한다', () => {
      const candidate: NonSensitiveDefaults = {
        reverseShippingSellerCost: 3500,
        handlingCost: 1000,
      };

      const result = saveDefaults(candidate, false);

      assert.equal(result, false);
      assert.equal(mockStorage.getItem(STORAGE_KEY), null);
      assert.equal(hasSavedDefaults(), false);
    });

    it('명시적 동의(explicitUserConsent = true)가 있을 때만 비민감 기본값이 저장되어야 한다', () => {
      const candidate: NonSensitiveDefaults = {
        reverseShippingSellerCost: 3500,
        handlingCost: 1000,
        replacementOutboundShipping: 3000,
        platform: 'NAVER',
      };

      const result = saveDefaults(candidate, true);

      assert.equal(result, true);
      assert.notEqual(mockStorage.getItem(STORAGE_KEY), null);
      assert.equal(hasSavedDefaults(), true);

      const loaded = loadSavedDefaults();
      assert.deepEqual(loaded, candidate);
    });
  });

  describe('2. 비민감 값만 저장 및 전체 환불액/고객 정보 저장 원천 금지', () => {
    it('환급 예정액(refundAmount), 부분환급액, 주문식별자 등 민감/개별 거래값은 완벽히 제거(strip)되어야 한다', () => {
      const forbiddenInput = {
        refundAmount: 50000,
        agreedPartialRefund: 25000,
        orderId: 'ORDER_20261103_001',
        customerName: '홍길동',
        phone: '010-1234-5678',
        buyerRequest: 'REFUND',
        reason: 'BUYER_REMORSE',
        reverseShippingSellerCost: 4000,
        handlingCost: 1500,
      };

      const sanitized = sanitizeDefaults(forbiddenInput);

      assert.equal((sanitized as Record<string, unknown>).refundAmount, undefined);
      assert.equal((sanitized as Record<string, unknown>).agreedPartialRefund, undefined);
      assert.equal((sanitized as Record<string, unknown>).orderId, undefined);
      assert.equal((sanitized as Record<string, unknown>).customerName, undefined);
      assert.equal((sanitized as Record<string, unknown>).phone, undefined);
      assert.equal((sanitized as Record<string, unknown>).buyerRequest, undefined);
      assert.equal((sanitized as Record<string, unknown>).reason, undefined);

      assert.equal(sanitized.reverseShippingSellerCost, 4000);
      assert.equal(sanitized.handlingCost, 1500);
    });

    it('음수나 10억 원 초과 비정상 금액은 저장 대상에서 제외되어야 한다', () => {
      const invalidInput = {
        reverseShippingSellerCost: -3000,
        handlingCost: 1_000_000_001,
        replacementOutboundShipping: 3000,
      };

      const sanitized = sanitizeDefaults(invalidInput);

      assert.equal(sanitized.reverseShippingSellerCost, undefined);
      assert.equal(sanitized.handlingCost, undefined);
      assert.equal(sanitized.replacementOutboundShipping, 3000);
    });
  });

  describe('3. TTL 90일 만료 및 구버전 스키마 마이그레이션 검증', () => {
    it('저장 후 90일(TTL)이 경과한 데이터는 자동으로 삭제되고 null을 반환해야 한다', () => {
      const expiredPayload = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        savedAt: Date.now() - (TTL_MS + 1000),
        expiresAt: Date.now() - 1000, // already expired!
        defaults: {
          reverseShippingSellerCost: 3500,
        },
      };

      mockStorage.setItem(STORAGE_KEY, JSON.stringify(expiredPayload));

      const loaded = loadSavedDefaults();
      assert.equal(loaded, null);
      // Expired data must be cleaned up from storage
      assert.equal(mockStorage.getItem(STORAGE_KEY), null);
    });

    it('구버전 스키마 또는 손상된 JSON은 안전하게 파기하고 null을 반환해야 한다', () => {
      // Outdated schema version
      mockStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          schemaVersion: 0,
          savedAt: Date.now(),
          expiresAt: Date.now() + TTL_MS,
          defaults: { reverseShippingSellerCost: 3000 },
        })
      );

      assert.equal(loadSavedDefaults(), null);
      assert.equal(mockStorage.getItem(STORAGE_KEY), null);

      // Malformed JSON string
      mockStorage.setItem(STORAGE_KEY, 'NOT_VALID_JSON{{{');
      assert.equal(loadSavedDefaults(), null);
      assert.equal(mockStorage.getItem(STORAGE_KEY), null);
    });
  });

  describe('4. 초기화 완전 삭제 (clearSavedDefaults)', () => {
    it('clearSavedDefaults 호출 시 저장된 기본값이 완전히 삭제되어야 한다', () => {
      saveDefaults({ reverseShippingSellerCost: 3500 }, true);
      assert.equal(hasSavedDefaults(), true);

      const cleared = clearSavedDefaults();
      assert.equal(cleared, true);
      assert.equal(mockStorage.getItem(STORAGE_KEY), null);
      assert.equal(hasSavedDefaults(), false);
      assert.equal(loadSavedDefaults(), null);
    });
  });

  describe('5. 브라우저 스토리지 차단 환경(시크릿 모드/QuotaExceeded) 무장애 폴백', () => {
    it('window 또는 localStorage가 존재하지 않거나 예외를 던져도 앱이 중단되지 않고 안전하게 처리되어야 한다', () => {
      // Simulate private browsing throwing SecurityError
      const brokenStorage = {
        getItem() {
          throw new Error('SecurityError: The operation is insecure.');
        },
        setItem() {
          throw new Error('SecurityError: The operation is insecure.');
        },
        removeItem() {
          throw new Error('SecurityError: The operation is insecure.');
        },
      };

      (global as unknown as { window: { localStorage: typeof brokenStorage } }).window = {
        localStorage: brokenStorage,
      };

      // None of these should throw!
      assert.equal(saveDefaults({ reverseShippingSellerCost: 3000 }, true), false);
      assert.equal(loadSavedDefaults(), null);
      assert.equal(clearSavedDefaults(), true);
      assert.equal(hasSavedDefaults(), false);
    });
  });
});
