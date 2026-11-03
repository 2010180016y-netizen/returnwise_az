/**
 * Opaque 256-bit server-side sessions backed by D1.
 * There is NO public session-minting endpoint. registerTrustedSession may
 * be called only after an independently verified magic-link/SSO login.
 */
import crypto from 'node:crypto';
import type { D1DatabaseLike } from './d1Types';

export interface ServerSession {
  sessionHash: string;
  userId: string;
  tenantId: string;
  role: 'OWNER' | 'MEMBER';
}

interface Membership {
  user_id: string;
  tenant_id: string;
  role: 'OWNER'|'MEMBER';
}

export class SessionAccessError extends Error {
  constructor(public readonly statusCode: 401|403, public readonly code: string) {
    super(code);
    this.name = 'SessionAccessError';
  }
}

function hashSession(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function assertToken(raw: string): string {
  if (!/^rw_[A-Za-z0-9_-]{40,100}$/.test(raw)) {
    throw new SessionAccessError(401, 'INVALID_SESSION');
  }
  return hashSession(raw);
}

export async function registerTrustedSession(
  db: D1DatabaseLike,
  verifiedUserId: string,
  verifiedTenantId: string,
  ttlMs: number = 8 * 60 * 60 * 1000
): Promise<string> {
  if (!verifiedUserId || !verifiedTenantId ||
      !Number.isSafeInteger(ttlMs) || ttlMs < 60000 || ttlMs > 86400000) {
    throw new SessionAccessError(403, 'UNVERIFIED_IDENTITY');
  }
  const member = await db.prepare(
    `SELECT u.id AS user_id,u.tenant_id,u.role FROM users u
     JOIN tenants t ON u.tenant_id=t.id
     WHERE u.id=? AND u.tenant_id=? AND t.status='ACTIVE'
       AND u.role IN ('OWNER','MEMBER')`
  ).bind(verifiedUserId, verifiedTenantId).first<Membership>();

  if (!member) throw new SessionAccessError(403, 'TENANT_MEMBERSHIP_REQUIRED');
  const token = 'rw_' + crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await db.prepare(
    `INSERT INTO billing_sessions(session_hash,tenant_id,user_id,expires_at,revoked_at,created_at)
     VALUES(?,?,?,?,NULL,?)`
  ).bind(hashSession(token), verifiedTenantId, verifiedUserId, now+ttlMs, now).run();
  return token;
}

export async function authenticateBearer(
  db: D1DatabaseLike,
  authorizationHeader: string | null,
  nowMs: number = Date.now()
): Promise<ServerSession> {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    throw new SessionAccessError(401, 'MISSING_BEARER');
  }
  const hash = assertToken(authorizationHeader.slice(7));
  const row = await db.prepare(
    `SELECT s.session_hash, s.tenant_id, s.user_id, u.role
     FROM billing_sessions s
     JOIN users u ON u.id=s.user_id AND u.tenant_id=s.tenant_id
     JOIN tenants t ON t.id=s.tenant_id
     WHERE s.session_hash=? AND s.revoked_at IS NULL
       AND s.expires_at > ? AND t.status='ACTIVE'
       AND u.role IN ('OWNER','MEMBER')`
  ).bind(hash, nowMs).first<{
    session_hash:string;tenant_id:string;user_id:string;role:'OWNER'|'MEMBER';
  }>();
  if (!row) throw new SessionAccessError(401, 'SESSION_EXPIRED_OR_REVOKED');
  return {
    sessionHash: row.session_hash,
    tenantId: row.tenant_id,
    userId: row.user_id,
    role: row.role,
  };
}

export async function revokeAuthenticatedSession(
  db: D1DatabaseLike,
  session: ServerSession
): Promise<boolean> {
  const result = await db.prepare(
    `UPDATE billing_sessions SET revoked_at=?
     WHERE session_hash=? AND user_id=? AND tenant_id=? AND revoked_at IS NULL`
  ).bind(Date.now(),session.sessionHash,session.userId,session.tenantId).run();
  return result.meta.changes === 1;
}

export function requireOwner(session: ServerSession): void {
  if (session.role !== 'OWNER') {
    throw new SessionAccessError(403, 'OWNER_ONLY');
  }
}
