/**
 * ReturnWise Pro Multi-Tenant & Server-Side Security Tests (tests/security/tenant.test.ts)
 * Verifies cross-tenant data CRUD isolation (403/404), RBAC server enforcement,
 * UI bypass defense, session token lifecycle, zero tokens in logs, and migration schema integrity.
 *
 * STRICT SAFETY CONDITIONS:
 * 1. 다른 조직 데이터 CRUD 403/404 차단.
 * 2. 관리자 UI 우회도 서버 차단 (서버 검증 없이 UI 숨김으로만 접근 통제 금지).
 * 3. 로그 내 토큰 0건.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  createSessionToken,
  verifySessionToken,
  revokeSession,
  clearRevocationList,
  sanitizeLog,
} from '../../server/auth/session';
import {
  tenantRepo,
  executeBillingManagement,
} from '../../server/auth/tenantGuard';
import type { UserSession } from '../../server/auth/types';
import { AuthError } from '../../server/auth/types';

const TEST_SECRET = 'super-secure-test-jwt-secret-key-32bytes-returnwise';

describe('T34 | Multi-Tenant Security & Server-Side RBAC Contract', () => {
  beforeEach(() => {
    tenantRepo.clear();
    clearRevocationList();
  });

  const tenantASessionOwner: UserSession = {
    userId: 'user_a_owner',
    tenantId: 'tenant_alpha',
    email: 'alpha_owner@example.com',
    role: 'OWNER',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const tenantASessionMember: UserSession = {
    userId: 'user_a_member',
    tenantId: 'tenant_alpha',
    email: 'alpha_staff@example.com',
    role: 'MEMBER',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  const tenantBSessionOwner: UserSession = {
    userId: 'user_b_owner',
    tenantId: 'tenant_beta',
    email: 'beta_owner@example.com',
    role: 'OWNER',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 3600000,
  };

  describe('1. 무상태 세션 토큰 라이프사이클 및 서명 검증', () => {
    it('유효한 세션 데이터로 생성된 토큰은 성공적으로 검증되어야 한다', () => {
      const token = createSessionToken(tenantASessionOwner, TEST_SECRET);
      assert.ok(token && typeof token === 'string');

      const verified = verifySessionToken(token, TEST_SECRET);
      assert.strictEqual(verified.tenantId, 'tenant_alpha');
      assert.strictEqual(verified.email, 'alpha_owner@example.com');
      assert.strictEqual(verified.role, 'OWNER');
    });

    it('서명이 위조된 토큰은 401 SIGNATURE_MISMATCH 에러로 거절되어야 한다', () => {
      const token = createSessionToken(tenantASessionOwner, TEST_SECRET);
      const parts = token.split('.');
      const tamperedPayload = Buffer.from(
        JSON.stringify({ ...tenantASessionOwner, role: 'SUPER_ADMIN' })
      ).toString('base64url');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      assert.throws(
        () => verifySessionToken(tamperedToken, TEST_SECRET),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 401);
          assert.strictEqual(err.code, 'SIGNATURE_MISMATCH');
          return true;
        }
      );
    });

    it('만료 시간이 지난 토큰은 401 TOKEN_EXPIRED 로 거절되어야 한다', () => {
      // 1초 유효 토큰 생성
      const token = createSessionToken(tenantASessionOwner, TEST_SECRET, 1000);
      const futureMs = Date.now() + 5000; // 5초 뒤 검증 시도

      assert.throws(
        () => verifySessionToken(token, TEST_SECRET, futureMs),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 401);
          assert.strictEqual(err.code, 'TOKEN_EXPIRED');
          return true;
        }
      );
    });

    it('로그아웃(폐기)된 토큰은 401 TOKEN_REVOKED 로 즉시 거절되어야 한다', () => {
      const token = createSessionToken(tenantASessionOwner, TEST_SECRET);
      revokeSession(token);

      assert.throws(
        () => verifySessionToken(token, TEST_SECRET),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 401);
          assert.strictEqual(err.code, 'TOKEN_REVOKED');
          return true;
        }
      );
    });
  });

  describe('2. 타 테넌트 데이터 CRUD 격리 검증 (다른 조직 데이터 403/404 차단)', () => {
    it('Tenant A가 생성한 반품 세션을 Tenant B가 조회할 경우 403 에러로 차단되어야 한다', () => {
      // Tenant A가 리소스 생성
      const recordA = tenantRepo.create(tenantASessionOwner, {
        market: 'SMARTSTORE',
        itemPrice: 30000,
        initialShipping: 3000,
        returnShipping: 3000,
        commissionRate: 5.5,
        bestOptionCode: 'C01',
        cashOutflow: 25350,
        economicCost: 16350,
      });

      // Tenant A는 정상 조회 가능
      const readByA = tenantRepo.getById(tenantASessionOwner, recordA.id);
      assert.strictEqual(readByA.id, recordA.id);

      // Tenant B가 Tenant A의 리소스 ID로 조회를 시도하면 403 거절!
      assert.throws(
        () => tenantRepo.getById(tenantBSessionOwner, recordA.id),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'FORBIDDEN_TENANT_ACCESS');
          return true;
        }
      );
    });

    it('Tenant B가 Tenant A의 데이터를 수정(UPDATE)하려 하면 403 에러로 차단되어야 한다', () => {
      const recordA = tenantRepo.create(tenantASessionOwner, {
        market: 'COUPANG',
        itemPrice: 7000,
        initialShipping: 3000,
        returnShipping: 3500,
        commissionRate: 10.8,
        bestOptionCode: 'C02',
        cashOutflow: 6244,
        economicCost: 6244,
      });

      assert.throws(
        () => tenantRepo.update(tenantBSessionOwner, recordA.id, { itemPrice: 99999 }),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'FORBIDDEN_TENANT_ACCESS');
          return true;
        }
      );
    });

    it('Tenant B가 Tenant A의 데이터를 삭제(DELETE)하려 하면 403 에러로 차단되어야 한다', () => {
      const recordA = tenantRepo.create(tenantASessionOwner, {
        market: 'ETC',
        itemPrice: 50000,
        initialShipping: 4000,
        returnShipping: 10000,
        commissionRate: 8.0,
        bestOptionCode: 'C03',
        cashOutflow: 13800,
        economicCost: 13800,
      });

      assert.throws(
        () => tenantRepo.delete(tenantBSessionOwner, recordA.id),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'FORBIDDEN_TENANT_ACCESS');
          return true;
        }
      );
    });

    it('존재하지 않는 리소스 조회 시 404 NOT_FOUND 를 반환해야 한다', () => {
      assert.throws(
        () => tenantRepo.getById(tenantASessionOwner, 'non_existent_id'),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 404);
          assert.strictEqual(err.code, 'NOT_FOUND');
          return true;
        }
      );
    });

    it('목록 조회 시 오직 본인 테넌트의 데이터만 반환되어야 한다', () => {
      tenantRepo.create(tenantASessionOwner, {
        market: 'SMARTSTORE',
        itemPrice: 10000,
        initialShipping: 3000,
        returnShipping: 3000,
        commissionRate: 5.5,
        bestOptionCode: 'C01',
        cashOutflow: 8000,
        economicCost: 5000,
      });

      tenantRepo.create(tenantBSessionOwner, {
        market: 'COUPANG',
        itemPrice: 20000,
        initialShipping: 3000,
        returnShipping: 3000,
        commissionRate: 10.8,
        bestOptionCode: 'C01',
        cashOutflow: 18000,
        economicCost: 12000,
      });

      const listA = tenantRepo.listByTenant(tenantASessionOwner);
      assert.strictEqual(listA.length, 1);
      assert.strictEqual(listA[0].tenantId, 'tenant_alpha');

      const listB = tenantRepo.listByTenant(tenantBSessionOwner);
      assert.strictEqual(listB.length, 1);
      assert.strictEqual(listB[0].tenantId, 'tenant_beta');
    });
  });

  describe('3. 관리자 UI 우회 차단 및 서버측 RBAC 권한 통제 (특별 안전조건)', () => {
    it('MEMBER 역할이 브라우저 UI를 우회하여 결제 관리를 호출하면 서버에서 403 차단되어야 한다', () => {
      // 테넌트 내부 직원(MEMBER)이 UI 숨김을 무시하고 직접 결제 취소 API를 호출하는 시나리오
      assert.throws(
        () =>
          executeBillingManagement(
            tenantASessionMember,
            'tenant_alpha',
            'CANCEL_SUBSCRIPTION'
          ),
        (err: unknown) => {
          assert.ok(err instanceof AuthError);
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'INSUFFICIENT_ROLE_PERMISSIONS');
          return true;
        }
      );
    });

    it('OWNER 역할의 요청은 정상 처리되어야 한다', () => {
      const res = executeBillingManagement(
        tenantASessionOwner,
        'tenant_alpha',
        'UPDATE_CARD'
      );
      assert.strictEqual(res.success, true);
    });
  });

  describe('4. 로그 내 토큰 누출 0건 검증 (Zero Token Leak)', () => {
    it('로그 정제 함수는 모든 JWT 세션 토큰을 마스킹하여 0건 노출을 보장해야 한다', () => {
      const token = createSessionToken(tenantASessionOwner, TEST_SECRET);
      const rawLog = `[INFO] User ${tenantASessionOwner.email} authenticated with token: ${token} at endpoint /api/returns`;

      const sanitized = sanitizeLog(rawLog);
      assert.ok(!sanitized.includes(token), '원시 토큰이 로그에 노출되어서는 안 됩니다.');
      assert.ok(
        sanitized.includes('[REDACTED_SESSION_TOKEN]'),
        '마스킹 문자열이 포함되어야 합니다.'
      );
    });
  });

  describe('5. D1 마이그레이션 DDL 스키마 무결성 검증', () => {
    it('db/migrations/0001_initial_schema.sql 파일이 존재하고 외래키 및 인덱스를 포함해야 한다', () => {
      const migrationPath = path.resolve('db/migrations/0001_initial_schema.sql');
      assert.ok(fs.existsSync(migrationPath), '마이그레이션 파일이 존재해야 합니다.');

      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('PRAGMA foreign_keys = ON;'), '외래키 활성화 PRAGMA가 있어야 합니다.');
      assert.ok(sql.includes('ON DELETE CASCADE'), 'ON DELETE CASCADE가 선언되어야 합니다.');
      assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS idx_users_tenant_id'), '인덱스가 있어야 합니다.');
      assert.ok(sql.includes('CREATE INDEX IF NOT EXISTS idx_return_sessions_tenant'), '인덱스가 있어야 합니다.');
    });
  });
});
