/**
 * ReturnWise Pro Server Auth & Multi-Tenant Types (server/auth/types.ts)
 */

export type UserRole = 'OWNER' | 'MEMBER' | 'ANONYMOUS';

export interface Tenant {
  id: string;
  name: string;
  plan: 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS';
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  createdAt: number;
  updatedAt: number;
}

export interface UserSession {
  userId: string;
  tenantId: string;
  email: string;
  role: UserRole;
  issuedAt: number;
  expiresAt: number;
}

export class AuthError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface ReturnSessionRecord {
  id: string;
  tenantId: string;
  market: string;
  itemPrice: number;
  initialShipping: number;
  returnShipping: number;
  commissionRate: number;
  bestOptionCode: string;
  cashOutflow: number;
  economicCost: number;
  createdAt: number;
}
