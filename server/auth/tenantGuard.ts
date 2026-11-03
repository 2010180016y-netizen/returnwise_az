/**
 * ReturnWise Pro Multi-Tenant Access Guard (server/auth/tenantGuard.ts)
 * Enforces strict tenant boundaries and RBAC on the server.
 *
 * SPECIAL SAFETY CONDITION:
 * 서버 검증 없이 UI 숨김으로만 접근 통제 금지.
 * (Server validation is mandatory on all operations, even if UI hides action buttons).
 */

import type { UserSession, UserRole, ReturnSessionRecord } from './types';
import { AuthError } from './types';

// In-memory multi-tenant repository for testing and demonstration
class MultiTenantRepository {
  private returnSessions = new Map<string, ReturnSessionRecord>();

  public clear(): void {
    this.returnSessions.clear();
  }

  /**
   * CREATE: Automatically binds resource to caller's tenantId
   */
  public create(
    session: UserSession,
    data: Omit<ReturnSessionRecord, 'id' | 'tenantId' | 'createdAt'>
  ): ReturnSessionRecord {
    // 1. Mandatory server session assertion
    if (!session || !session.tenantId) {
      throw new AuthError(401, 'UNAUTHORIZED', '인증되지 않은 요청입니다.');
    }

    const id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const record: ReturnSessionRecord = {
      ...data,
      id,
      tenantId: session.tenantId, // FORCED server-side scoping
      createdAt: Date.now(),
    };

    this.returnSessions.set(id, record);
    return record;
  }

  /**
   * READ: Strictly asserts that the resource belongs to the session's tenant
   */
  public getById(session: UserSession, resourceId: string): ReturnSessionRecord {
    const record = this.returnSessions.get(resourceId);

    // If resource does not exist, or belongs to another tenant, return 404/403
    if (!record) {
      throw new AuthError(404, 'NOT_FOUND', '요청하신 리소스를 찾을 수 없습니다.');
    }

    if (record.tenantId !== session.tenantId) {
      // Cross-tenant data leakage strictly blocked!
      throw new AuthError(403, 'FORBIDDEN_TENANT_ACCESS', '다른 조직의 데이터에 접근할 권한이 없습니다.');
    }

    return record;
  }

  /**
   * UPDATE: Strictly asserts tenant boundary before modification
   */
  public update(
    session: UserSession,
    resourceId: string,
    updates: Partial<Omit<ReturnSessionRecord, 'id' | 'tenantId' | 'createdAt'>>
  ): ReturnSessionRecord {
    const record = this.getById(session, resourceId);

    const updatedRecord: ReturnSessionRecord = {
      ...record,
      ...updates,
    };

    this.returnSessions.set(resourceId, updatedRecord);
    return updatedRecord;
  }

  /**
   * DELETE: Strictly asserts tenant boundary before deletion
   */
  public delete(session: UserSession, resourceId: string): boolean {
    // getById asserts tenant boundary and throws 403/404 if cross-tenant
    this.getById(session, resourceId);
    return this.returnSessions.delete(resourceId);
  }

  /**
   * LIST: Strictly scopes query by session tenantId
   */
  public listByTenant(session: UserSession): ReturnSessionRecord[] {
    const results: ReturnSessionRecord[] = [];
    for (const record of this.returnSessions.values()) {
      if (record.tenantId === session.tenantId) {
        results.push(record);
      }
    }
    return results;
  }
}

export const tenantRepo = new MultiTenantRepository();

/**
 * Asserts that the caller has one of the allowed roles
 */
export function assertRole(session: UserSession, allowedRoles: UserRole[]): void {
  if (!session || !allowedRoles.includes(session.role)) {
    throw new AuthError(
      403,
      'INSUFFICIENT_ROLE_PERMISSIONS',
      `해당 작업을 수행할 권한이 없습니다. (필요 권한: ${allowedRoles.join(', ')})`
    );
  }
}

/**
 * Sensitive Admin/Billing Operation
 * Requires OWNER role on the server, regardless of frontend UI state.
 */
export function executeBillingManagement(
  session: UserSession,
  targetTenantId: string,
  action: 'UPDATE_CARD' | 'CANCEL_SUBSCRIPTION'
): { success: boolean; message: string } {
  // 1. Mandatory server session verification
  if (!session || !session.tenantId) {
    throw new AuthError(401, 'UNAUTHORIZED', '인증되지 않은 요청입니다.');
  }

  // 2. Strict tenant boundary assertion
  if (session.tenantId !== targetTenantId) {
    throw new AuthError(403, 'FORBIDDEN_TENANT_ACCESS', '타 조직의 결제 정보를 변경할 수 없습니다.');
  }

  // 3. Strict Server-Side Role-Based Access Control (RBAC)
  // Even if a MEMBER manipulates the browser DOM to click a hidden button,
  // the server strictly rejects with 403 Forbidden!
  assertRole(session, ['OWNER']);

  return {
    success: true,
    message: `테넌트 [${targetTenantId}]의 결제 작업 [${action}]이 정상 처리되었습니다.`,
  };
}
