/**
 * ReturnWise Pro Cases Lifecycle, Retention, Deletion & Backup Tests (tests/security/cases_lifecycle.test.ts)
 * Verifies No-PII rejection, idempotency, 404 after deletion, tenant separation,
 * backup restore integrity, retention purge, and migration rollback scripts.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 고객 이름·주소·주문번호 강제 수집 금지 (No-PII).
 * 2. 삭제 후 재조회 불가 (404 Not Found).
 * 3. 테넌트 분리 테스트 (Cross-tenant 403).
 * 4. 백업 복원 및 DB migration 롤백 점검.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { caseService } from '../../server/cases/caseService';
import type { UserSession } from '../../server/auth/types';
import { AuthError } from '../../server/auth/types';

describe('T35 | Cases Lifecycle, Retention, Deletion & Backup Contract', () => {
  beforeEach(() => {
    caseService.clear();
  });

  const sessionTenantA: UserSession = {
    userId: 'user_a_owner',
    tenantId: 'tenant_alpha',
    email: 'alpha_owner@example.com',
    role: 'OWNER',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const sessionTenantB: UserSession = {
    userId: 'user_b_owner',
    tenantId: 'tenant_beta',
    email: 'beta_owner@example.com',
    role: 'OWNER',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  describe('1. No-PII 안전조건 검증 (고객 이름·주소·주문번호 수집 차단)', () => {
    it('고객 이름이나 실제 주문번호가 포함된 입력은 400 에러로 즉시 거절되어야 한다', () => {
      assert.throws(
        () =>
          caseService.createCase(sessionTenantA, {
            market: 'SMARTSTORE',
            itemPrice: 30000,
            initialShipping: 3000,
            returnShipping: 3000,
            commissionRate: 5.5,
            bestOptionCode: 'C01',
            cashOutflow: 25350,
            economicCost: 16350,
            customerName: '홍길동', // PII 포함 시도!
          }),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'PII_COLLECTION_FORBIDDEN');
          return true;
        }
      );

      assert.throws(
        () =>
          caseService.createCase(sessionTenantA, {
            market: 'COUPANG',
            itemPrice: 7000,
            initialShipping: 3000,
            returnShipping: 3500,
            commissionRate: 10.8,
            bestOptionCode: 'C02',
            cashOutflow: 6244,
            economicCost: 6244,
            orderNumber: '20261103-9999999', // 외부 주문번호 포함 시도!
          }),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'PII_COLLECTION_FORBIDDEN');
          return true;
        }
      );
    });

    it('순수 금액과 내부 식별자만 포함된 정상 입력은 성공적으로 등록되어야 한다', () => {
      const created = caseService.createCase(sessionTenantA, {
        market: 'SMARTSTORE',
        itemPrice: 30000,
        initialShipping: 3000,
        returnShipping: 3000,
        commissionRate: 5.5,
        bestOptionCode: 'C01',
        cashOutflow: 25350,
        economicCost: 16350,
      });

      assert.ok(created.id.startsWith('case_'));
      assert.strictEqual(created.tenantId, 'tenant_alpha');
      assert.strictEqual(created.itemPrice, 30000);
      assert.strictEqual(created.isDeleted, false);
    });
  });

  it('missing policy verification must never be stored as verified recommendation', () => {
    const created = caseService.createCase(sessionTenantA, {
      market: 'SMARTSTORE',
      itemPrice: 30000,
      initialShipping: 3000,
      returnShipping: 3500,
      commissionRate: 5.5,
      bestOptionCode: 'C03',
      cashOutflow: 15000,
      economicCost: 15000,
    });
    assert.equal(created.policyVerified, false);
    assert.equal(created.bestOptionCode, 'REVIEW_REQUIRED');
  });

  it('expired case must be inaccessible even before scheduled purge', () => {
    const created = caseService.createCase(sessionTenantA, {
      market: 'SMARTSTORE',
      itemPrice: 30000,
      initialShipping: 3000,
      returnShipping: 3500,
      commissionRate: 5.5,
      bestOptionCode: 'C01',
      cashOutflow: 30000,
      economicCost: 30000,
    });
    created.retentionExpiresAt = Date.now() - 1;
    assert.throws(
      () => caseService.getCaseById(sessionTenantA, created.id),
      (err: unknown) => err instanceof AuthError && err.statusCode === 404
    );
  });

  describe('2. 멱등성 (Idempotency) 검증', () => {
    it('동일한 멱등키로 재요청 시 중복 생성 없이 기존 레코드가 반환되어야 한다', () => {
      const key = 'req_idemp_12345';
      const first = caseService.createCase(sessionTenantA, {
        idempotencyKey: key,
        market: 'COUPANG',
        itemPrice: 15000,
        initialShipping: 3000,
        returnShipping: 3000,
        commissionRate: 10.8,
        bestOptionCode: 'C01',
        cashOutflow: 12000,
        economicCost: 9000,
      });

      const second = caseService.createCase(sessionTenantA, {
        idempotencyKey: key,
        market: 'COUPANG',
        itemPrice: 15000,
        initialShipping: 3000,
        returnShipping: 3000,
        commissionRate: 10.8,
        bestOptionCode: 'C01',
        cashOutflow: 12000,
        economicCost: 9000,
      });

      assert.strictEqual(first.id, second.id, '동일 멱등키는 동일한 케이스 ID를 반환해야 합니다.');
      assert.strictEqual(caseService.listCases(sessionTenantA).length, 1);
    });
  });

  describe('3. 삭제 후 재조회 불가 검증 (합격 판정기준: 404 NOT_FOUND)', () => {
    it('케이스를 삭제하면 getCaseById 호출 시 404 에러로 재조회가 불가능해야 한다', () => {
      const created = caseService.createCase(sessionTenantA, {
        market: 'SMARTSTORE',
        itemPrice: 20000,
        initialShipping: 3000,
        returnShipping: 3000,
        commissionRate: 5.5,
        bestOptionCode: 'C01',
        cashOutflow: 18000,
        economicCost: 12000,
      });

      // 삭제 전 조회 성공
      const before = caseService.getCaseById(sessionTenantA, created.id);
      assert.strictEqual(before.id, created.id);

      // 삭제 실행
      const deleted = caseService.deleteCase(sessionTenantA, created.id, false);
      assert.strictEqual(deleted, true);

      // 삭제 후 재조회 시 404 반환!
      assert.throws(
        () => caseService.getCaseById(sessionTenantA, created.id),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 404);
          assert.strictEqual(err.code, 'NOT_FOUND');
          return true;
        }
      );
    });
  });

  describe('4. 테넌트 간 격리 검증 (Cross-Tenant 403)', () => {
    it('Tenant A의 케이스에 Tenant B가 접근하면 403 에러로 차단되어야 한다', () => {
      const createdA = caseService.createCase(sessionTenantA, {
        market: 'SMARTSTORE',
        itemPrice: 40000,
        initialShipping: 3000,
        returnShipping: 3000,
        commissionRate: 5.5,
        bestOptionCode: 'C01',
        cashOutflow: 35000,
        economicCost: 25000,
      });

      assert.throws(
        () => caseService.getCaseById(sessionTenantB, createdA.id),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'FORBIDDEN_TENANT_ACCESS');
          return true;
        }
      );

      assert.throws(
        () => caseService.deleteCase(sessionTenantB, createdA.id),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'FORBIDDEN_TENANT_ACCESS');
          return true;
        }
      );
    });
  });

  describe('5. 백업 생성 및 복원 점검 (Backup & Disaster Recovery)', () => {
    it('백업 스냅샷을 생성하고 동일 테넌트에 온전히 복원할 수 있어야 한다', () => {
      caseService.createCase(sessionTenantA, {
        market: 'SMARTSTORE',
        itemPrice: 10000,
        initialShipping: 3000,
        returnShipping: 3000,
        commissionRate: 5.5,
        bestOptionCode: 'C01',
        cashOutflow: 8000,
        economicCost: 5000,
      });

      const snapshot = caseService.createBackupSnapshot(sessionTenantA);
      assert.strictEqual(snapshot.tenantId, 'tenant_alpha');
      assert.strictEqual(snapshot.cases.length, 1);

      // 데이터 소실 시뮬레이션
      caseService.clear();
      assert.strictEqual(caseService.listCases(sessionTenantA).length, 0);

      // 복원 실행
      const restoreResult = caseService.restoreFromBackupSnapshot(sessionTenantA, snapshot);
      assert.strictEqual(restoreResult.restoredCount, 1);
      assert.strictEqual(caseService.listCases(sessionTenantA).length, 1);
    });

    it('타 테넌트의 백업 스냅샷을 다른 조직에 복원하려 하면 403 에러로 차단되어야 한다', () => {
      caseService.createCase(sessionTenantA, {
        market: 'COUPANG',
        itemPrice: 20000,
        initialShipping: 3000,
        returnShipping: 3000,
        commissionRate: 10.8,
        bestOptionCode: 'C02',
        cashOutflow: 18000,
        economicCost: 18000,
      });

      const snapshotA = caseService.createBackupSnapshot(sessionTenantA);

      // Tenant B가 Tenant A의 백업 스냅샷을 복원 시도
      assert.throws(
        () => caseService.restoreFromBackupSnapshot(sessionTenantB, snapshotA),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'CROSS_TENANT_RESTORE_FORBIDDEN');
          return true;
        }
      );
    });
  });

  describe('6. 데이터 보존 기간(Retention) 만료 및 자동 파기 점검', () => {
    it('보존 기간이 지난 레코드는 목록에서 숨겨지고 purge 시 완전히 삭제되어야 한다', () => {
      // 1일 보존 케이스 생성
      const created = caseService.createCase(sessionTenantA, {
        market: 'SMARTSTORE',
        itemPrice: 5000,
        initialShipping: 3000,
        returnShipping: 3000,
        commissionRate: 5.5,
        bestOptionCode: 'C02',
        cashOutflow: 4000,
        economicCost: 4000,
        retentionDays: 1,
      });
      assert.ok(created.id);

      const futureNow = Date.now() + 2 * 24 * 60 * 60 * 1000; // 2일 후

      // 만료 후 목록 조회 시 0건
      const activeList = caseService.listCases(sessionTenantA, futureNow);
      assert.strictEqual(activeList.length, 0);

      // 파기 배치 실행
      const purgedCount = caseService.purgeExpiredCases(futureNow);
      assert.strictEqual(purgedCount, 1);
    });
  });

  describe('7. DB 마이그레이션 0002 및 롤백 스크립트 검증', () => {
    it('db/migrations/0002_cases_schema.sql 파일이 존재하고 인덱스를 포함해야 한다', () => {
      const upPath = path.resolve('db/migrations/0002_cases_schema.sql');
      assert.ok(fs.existsSync(upPath));
      const sql = fs.readFileSync(upPath, 'utf-8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS cases'));
      assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS idx_cases_tenant_created'));
      assert.ok(sql.includes('idempotency_key'));
    });

    it('db/manual_rollback/0002_cases_rollback.sql 파일이 존재하고 DROP 명령을 포함해야 한다', () => {
      const downPath = path.resolve('db/migrations/0002_cases_rollback.sql');
      assert.ok(fs.existsSync(downPath));
      assert.ok(!fs.existsSync(path.resolve('db/migrations/0002_cases_rollback.sql')));
      const sql = fs.readFileSync(downPath, 'utf-8');
      assert.ok(sql.includes('DROP TABLE IF EXISTS cases;'));
      assert.ok(sql.includes('DROP INDEX IF EXISTS idx_cases_tenant_created;'));
    });
  });
});
