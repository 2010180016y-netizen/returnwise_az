/**
 * ReturnWise Pro Billing Types (server/billing/types.ts)
 */

export type SubscriptionStatus =
  | 'UNPAID'
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'REFUNDED';

export interface SubscriptionRecord {
  tenantId: string;
  plan: 'FREE' | 'STARTER' | 'PRO' | 'BUSINESS';
  status: SubscriptionStatus;
  billingKey?: string;
  customerKey?: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  trialEndsAt?: number;
  cancelAtPeriodEnd: boolean;
  failedAttempts: number;
  lastPaymentKey?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TossWebhookPayload {
  eventType:
    | 'PAYMENT_STATUS_CHANGED'
    | 'BILLING_KEY_DELETED'
    | 'SUBSCRIPTION_CANCELED';
  createdAt: string;
  data: {
    paymentKey: string;
    orderId: string;
    status: 'DONE' | 'CANCELED' | 'PARTIAL_CANCELED' | 'ABORTED' | 'EXPIRED';
    totalAmount: number;
    method?: string;
    customerKey?: string;
    billingKey?: string;
    cancels?: Array<{
      cancelAmount: number;
      cancelReason: string;
      canceledAt: string;
    }>;
  };
}

export interface WebhookResult {
  success: boolean;
  message: string;
  status: SubscriptionStatus;
  duplicateIgnored?: boolean;
}
