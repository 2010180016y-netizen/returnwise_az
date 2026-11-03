/**
 * ReturnWise Pro Server-Side Session & Stateless JWT Auth (server/auth/session.ts)
 * No password stored. Verifies HMAC-SHA256 signatures, token expiration, revocation,
 * and ensures 0 raw tokens appear in logs.
 */

import crypto from 'crypto';
import type { UserSession } from './types';
import { AuthError } from './types';

// In-memory blacklist for revoked/logged-out tokens
const revokedTokens = new Set<string>();

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function sign(headerAndPayload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(headerAndPayload)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Creates a stateless signed session token
 */
export function createSessionToken(
  sessionData: Omit<UserSession, 'issuedAt' | 'expiresAt'>,
  secret: string,
  expiresInMs: number = 24 * 60 * 60 * 1000 // 24 hours default
): string {
  const now = Date.now();
  const session: UserSession = {
    ...sessionData,
    issuedAt: now,
    expiresAt: now + expiresInMs,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = sign(`${header}.${payload}`, secret);

  return `${header}.${payload}.${signature}`;
}

/**
 * Verifies a session token on the server
 */
export function verifySessionToken(
  token: string,
  secret: string,
  nowMs: number = Date.now()
): UserSession {
  if (!token || typeof token !== 'string') {
    throw new AuthError(401, 'INVALID_TOKEN', '세션 토큰이 제공되지 않았습니다.');
  }

  if (revokedTokens.has(token)) {
    throw new AuthError(401, 'TOKEN_REVOKED', '로그아웃 또는 만료되어 폐기된 토큰입니다.');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AuthError(401, 'MALFORMED_TOKEN', '위변조되었거나 잘못된 토큰 형식입니다.');
  }

  const [header, payload, signature] = parts;
  const expectedSignature = sign(`${header}.${payload}`, secret);

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new AuthError(401, 'SIGNATURE_MISMATCH', '서명이 유효하지 않은 위조 토큰입니다.');
  }

  let session: UserSession;
  try {
    session = JSON.parse(base64UrlDecode(payload));
  } catch {
    throw new AuthError(401, 'INVALID_PAYLOAD', '토큰 페이로드를 파싱할 수 없습니다.');
  }

  if (nowMs > session.expiresAt) {
    throw new AuthError(401, 'TOKEN_EXPIRED', '세션 유효기간이 만료되었습니다. 다시 로그인해 주세요.');
  }

  return session;
}

/**
 * Revokes a session token (Logout)
 */
export function revokeSession(token: string): void {
  revokedTokens.add(token);
}

/**
 * Clear revocation list (for testing)
 */
export function clearRevocationList(): void {
  revokedTokens.clear();
}

/**
 * Redacts tokens from log messages to strictly prevent token leakage
 */
export function sanitizeLog(message: string): string {
  // Matches standard JWT-like tokens: eyJ...
  const jwtRegex = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
  return message.replace(jwtRegex, '[REDACTED_SESSION_TOKEN]');
}
