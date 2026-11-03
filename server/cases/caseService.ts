/**
 * ReturnWise Pro Case Service with Lifecycle, Idempotency, Retention & Backup (server/cases/caseService.ts)
 *
 * SPECIAL SAFETY CONDITIONS:
 * 1. 고객 이름·주소·주문번호 강제 수집 금지 (No-PII).
 * 2. 삭제 후 재조회 불가 (404 Not Found).
 * 3. 테넌트 간 데이터 철저 분리 (403 Forbidden).
 */

import type { UserSession } from '../auth/types';
import { AuthError } from '../auth/types';
import type { CaseRecord, CreateCaseInput, BackupSnapshot } from './types';

export class CaseService {
  private cases = new Map<string, CaseRecord>();
  private idempotencyIndex = new Map<string, string>(); // `tenantId:key` -> caseId
  /** In-memory defense; remote D1 keeps the authoritative durable tombstones. */
  private deletedIds = new Set<string>();
  private deletedIdempotencyKeys = new Set<string>();

  public clear(): void {
    this.cases.clear();
    this.idempotencyIndex.clear();
    // Keep tombstones on simulated data loss; D1 owns durability in production.
  }

  /**
   * 1. CREATE CASE: Idempotent and strictly No-PII
   */
  public createCase(session: UserSession, input: CreateCaseInput): CaseRecord {
    if (!session || !session.tenantId) {
      throw new AuthError(401, 'UNAUTHORIZED', '인증되지 않은 요청입니다.');
    }

    // SPECIAL SAFETY CONDITION: Reject any customer PII
    if (
      input.customerName !== undefined ||
      input.customerAddress !== undefined ||
      input.orderNumber !== undefined ||
      input.phone !== undefined
    ) {
      throw new AuthError(
        400,
        'PII_COLLECTION_FORBIDDEN',
        '고객의 이름, 주소, 실제 주문번호, 전화번호는 수집 및 저장이 엄격히 금지됩니다.'
      );
    }

    // IDEMPOTENCY CHECK: If already processed with this key, return existing record
    if (input.idempotencyKey) {
      const compositeKey = `${session.tenantId}:${input.idempotencyKey}`;
      if (this.deletedIdempotencyKeys.has(compositeKey)) {
        throw new AuthError(409, 'IDEMPOTENCY_KEY_DELETED',
          '삭제된 케이스의 요청 키를 재사용할 수 없습니다.');
      }
      const existingId = this.idempotencyIndex.get(compositeKey);
      if (existingId) {
        const existingRecord = this.cases.get(existingId);
        if (existingRecord && !existingRecord.isDeleted) {
          const expectedOption=input.policyVerified===true
            ? input.bestOptionCode : 'REVIEW_REQUIRED';
          if (existingRecord.market!==input.market ||
              existingRecord.itemPrice!==input.itemPrice ||
              existingRecord.initialShipping!==input.initialShipping ||
              existingRecord.returnShipping!==input.returnShipping ||
              existingRecord.commissionRate!==input.commissionRate ||
              existingRecord.bestOptionCode!==expectedOption ||
              existingRecord.cashOutflow!==input.cashOutflow ||
              existingRecord.economicCost!==input.economicCost ||
              existingRecord.policyVerified!==(input.policyVerified===true)) {
            throw new AuthError(409,'IDEMPOTENCY_PAYLOAD_MISMATCH',
              '동일한 요청 키로 서로 다른 계산 결과를 생성할 수 없습니다.');
          }
          return existingRecord;
        }
      }
    }

    const now = Date.now();
    const caseId = `case_${now}_${Math.random().toString(36).substring(2, 8)}`;
    const retentionDays = input.retentionDays ?? 365;
    if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
      throw new AuthError(400, 'INVALID_RETENTION', '보관기간은 1~3650일 정수여야 합니다.');
    }
    const retentionExpiresAt = now + retentionDays * 24 * 60 * 60 * 1000;

    const record: CaseRecord = {
      id: caseId,
      tenantId: session.tenantId,
      idempotencyKey: input.idempotencyKey,
      market: input.market,
      itemPrice: input.itemPrice,
      initialShipping: input.initialShipping,
      returnShipping: input.returnShipping,
      commissionRate: input.commissionRate,
      // Unverified imports must not be silently written as a "best option".
      bestOptionCode: input.policyVerified === true ? input.bestOptionCode : 'REVIEW_REQUIRED',
      cashOutflow: input.cashOutflow,
      economicCost: input.economicCost,
      // A missing/invalid baseline must remain unknown, never guessed later.
      baselineEconomicCost: input.policyVerified === true &&
        typeof input.baselineEconomicCost === 'number' &&
        Number.isSafeInteger(input.baselineEconomicCost) &&
        input.baselineEconomicCost >= input.economicCost
          ? input.baselineEconomicCost : undefined,
      policyVerified: input.policyVerified === true,
      retentionExpiresAt,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    this.cases.set(caseId, record);

    if (input.idempotencyKey) {
      this.idempotencyIndex.set(`${session.tenantId}:${input.idempotencyKey}`, caseId);
    }

    return record;
  }

  /**
   * 2. READ CASE: Strict tenant isolation and 404 on deleted
   */
  public getCaseById(session: UserSession, caseId: string): CaseRecord {
    if (!session || !session.tenantId) {
      throw new AuthError(401, 'UNAUTHORIZED', '인증되지 않은 요청입니다.');
    }
    const record = this.cases.get(caseId);

    if (!record || record.isDeleted || record.retentionExpiresAt <= Date.now()) {
      throw new AuthError(404, 'NOT_FOUND', '요청하신 반품 케이스를 찾을 수 없습니다.');
    }

    if (record.tenantId !== session.tenantId) {
      throw new AuthError(403, 'FORBIDDEN_TENANT_ACCESS', '다른 조직의 케이스에 접근할 수 없습니다.');
    }

    return record;
  }

  /**
   * 3. DELETE CASE: Soft/Hard delete. Calling getCaseById afterward returns 404!
   */
  public deleteCase(session: UserSession, caseId: string, hardDelete: boolean = false): boolean {
    const record = this.getCaseById(session, caseId); // validates tenant
    this.deletedIds.add(`${session.tenantId}:${caseId}`);
    if (record.idempotencyKey) {
      const key=`${session.tenantId}:${record.idempotencyKey}`;
      this.deletedIdempotencyKeys.add(key);
      this.idempotencyIndex.delete(key);
    }

    if (hardDelete) {
      if (record.idempotencyKey) {
        this.idempotencyIndex.delete(`${session.tenantId}:${record.idempotencyKey}`);
      }
      return this.cases.delete(caseId);
    } else {
      record.isDeleted = true;
      record.updatedAt = Date.now();
      this.cases.set(caseId, record);
      return true;
    }
  }

  /**
   * 4. LIST CASES: Scoped to caller tenant, excludes deleted & expired
   */
  public listCases(session: UserSession, nowMs: number = Date.now()): CaseRecord[] {
    if (!session || !session.tenantId) {
      throw new AuthError(401, 'UNAUTHORIZED', '인증되지 않은 요청입니다.');
    }

    const results: CaseRecord[] = [];
    for (const record of this.cases.values()) {
      if (
        record.tenantId === session.tenantId &&
        !record.isDeleted &&
        record.retentionExpiresAt > nowMs
      ) {
        results.push(record);
      }
    }
    return results;
  }

  /**
   * 5. EXPORT CASES: Safe CSV or JSON export
   */
  public exportCases(session: UserSession, format: 'json' | 'csv'): string {
    const records = this.listCases(session);

    if (format === 'json') {
      return JSON.stringify(records, null, 2);
    }

    const headers = [
      'case_id',
      'market',
      'item_price',
      'initial_shipping',
      'return_shipping',
      'commission_rate',
      'best_option_code',
      'cash_outflow',
      'economic_cost',
      'created_at',
    ];

    const rows = records.map((r) =>
      [
        r.id,
        r.market,
        r.itemPrice,
        r.initialShipping,
        r.returnShipping,
        r.commissionRate,
        r.bestOptionCode,
        r.cashOutflow,
        r.economicCost,
        new Date(r.createdAt).toISOString(),
      ].join(',')
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * 6. BACKUP SNAPSHOT: Captures tenant's current cases
   */
  public createBackupSnapshot(session: UserSession): BackupSnapshot {
    const activeCases = this.listCases(session);
    return {
      tenantId: session.tenantId,
      timestamp: Date.now(),
      cases: JSON.parse(JSON.stringify(activeCases)),
    };
  }

  /**
   * 7. RESTORE FROM BACKUP: Cross-tenant restore strictly blocked (403)
   */
  public restoreFromBackupSnapshot(
    session: UserSession,
    snapshot: BackupSnapshot
  ): { restoredCount: number } {
    if (!session || !session.tenantId) {
      throw new AuthError(401, 'UNAUTHORIZED', '인증되지 않은 요청입니다.');
    }

    if (snapshot.tenantId !== session.tenantId) {
      throw new AuthError(
        403,
        'CROSS_TENANT_RESTORE_FORBIDDEN',
        '타 조직의 백업 스냅샷을 현재 테넌트에 복원할 수 없습니다.'
      );
    }

    if (!Array.isArray(snapshot.cases)) {
      throw new AuthError(400, 'INVALID_BACKUP_SNAPSHOT', '잘못된 백업 형식입니다.');
    }
    let count = 0;
    const now = Date.now();
    for (const item of snapshot.cases) {
      if (!item || typeof item.id!=='string' ||
          item.tenantId!==session.tenantId) {
        throw new AuthError(403, 'CROSS_TENANT_RESTORE_FORBIDDEN',
          '백업 레코드의 조직 식별자가 다릅니다.');
      }
      const scopedId=`${session.tenantId}:${item.id}`;
      const scopedKey=item.idempotencyKey
        ? `${session.tenantId}:${item.idempotencyKey}` : null;
      // Never resurrect a delete, expired record or stale snapshot.
      if (this.deletedIds.has(scopedId) ||
          (scopedKey && this.deletedIdempotencyKeys.has(scopedKey)) ||
          item.isDeleted || item.retentionExpiresAt<=now) {
        continue;
      }
      const newer=this.cases.get(item.id);
      if (newer && (newer.isDeleted || newer.updatedAt>=item.updatedAt)) continue;
      const restoredItem: CaseRecord = {
        ...item,
        tenantId: session.tenantId,
        // An old snapshot cannot independently certify legal/policy review.
        policyVerified: false,
        bestOptionCode: 'REVIEW_REQUIRED',
        baselineEconomicCost: undefined,
        isDeleted: false,
      };
      this.cases.set(restoredItem.id, restoredItem);
      if (scopedKey) this.idempotencyIndex.set(scopedKey,restoredItem.id);
      count++;
    }
    return { restoredCount: count };
  }

  /**
   * 8. RETENTION PURGE: Automatically purges records past retentionExpiresAt
   */
  public purgeExpiredCases(nowMs: number = Date.now()): number {
    let purged = 0;
    for (const [id, record] of this.cases.entries()) {
      if (record.retentionExpiresAt <= nowMs) {
        this.cases.delete(id);
        if (record.idempotencyKey) {
          this.idempotencyIndex.delete(`${record.tenantId}:${record.idempotencyKey}`);
        }
        purged++;
      }
    }
    return purged;
  }
}

export const caseService = new CaseService();
