/**
 * S3 D1 transactional billing ledger.
 *
 * The D1 batch is ONE SQLite transaction. A unique-key failure rolls back
 * event insertion, order update, and entitlement update together.
 * All authority (tenant/plan/amount/period) comes from an immutable DB order.
 */
import type { D1DatabaseLike } from '../worker/d1Types';
import type {
  BillingLedger, BillingOrder, VerifiedCommit, VerifiedSubscriptionStatus,
} from './verifiedBilling';
import { BillingSecurityError } from './verifiedBilling';

interface OrderRow {
  order_id: string; tenant_id: string; m_id: string; amount: number;
  plan: 'STARTER' | 'PRO'; period_start: number; period_end: number;
  expected_payment_key: string | null;
}
interface EventRow {
  event_key: string; tenant_id: string; order_id: string; payment_key: string;
  status: VerifiedSubscriptionStatus;
}
interface EntitlementRow {
  tenant_id: string; order_id: string; payment_key: string; plan: 'STARTER'|'PRO';
  status: VerifiedSubscriptionStatus; period_start: number; period_end: number;
}
const RANK: Record<VerifiedSubscriptionStatus, number> = {
  PAST_DUE: 1, ACTIVE: 2, REFUNDED: 3,
};

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|PRIMARY KEY constraint failed/i.test(error.message);
}

function validCommit(c: VerifiedCommit): boolean {
  return Boolean(
    c.eventKey && c.eventKey.length <= 200 &&
    c.orderId && c.tenantId && c.paymentKey && c.mId &&
    (c.plan === 'STARTER' || c.plan === 'PRO') &&
    Object.prototype.hasOwnProperty.call(RANK, c.status) &&
    Number.isSafeInteger(c.amount) && c.amount > 0 &&
    Number.isSafeInteger(c.periodStart) && Number.isSafeInteger(c.periodEnd) &&
    c.periodStart < c.periodEnd &&
    Number.isSafeInteger(c.occurredAt) && c.occurredAt > 0
  );
}

export function createD1BillingLedger(db: D1DatabaseLike): BillingLedger {
  async function findOrder(orderId: string): Promise<BillingOrder | null> {
    const row = await db.prepare(
      `SELECT order_id, tenant_id, m_id, amount, plan,
       period_start, period_end, expected_payment_key
       FROM billing_orders WHERE order_id = ?`
    ).bind(orderId).first<OrderRow>();
    if (!row) return null;
    return {
      orderId: row.order_id, tenantId: row.tenant_id, mId: row.m_id,
      amount: row.amount, plan: row.plan,
      periodStart: row.period_start, periodEnd: row.period_end,
      expectedPaymentKey: row.expected_payment_key ?? undefined,
    };
  }

  async function applyVerified(commit: VerifiedCommit): Promise<'APPLIED'|'DUPLICATE'|'STALE'> {
    if (!validCommit(commit)) throw new BillingSecurityError('INVALID_VERIFIED_COMMIT');

    const rank = RANK[commit.status];
    const createdAt = Date.now();
    try {
      const result = await db.batch([
        db.prepare(`
          INSERT INTO billing_events
            (event_key,order_id,tenant_id,payment_key,status,state_rank,occurred_at,created_at)
          SELECT ?, o.order_id, o.tenant_id, ?, ?, ?, ?, ?
          FROM billing_orders AS o
          WHERE o.order_id=? AND o.tenant_id=? AND o.m_id=?
            AND o.amount=? AND o.plan=? AND o.period_start=? AND o.period_end=?
            AND (o.expected_payment_key IS NULL OR o.expected_payment_key=?)
            AND (o.payment_key IS NULL OR o.payment_key=?)
        `).bind(
          commit.eventKey,commit.paymentKey,commit.status,rank,commit.occurredAt,createdAt,
          commit.orderId,commit.tenantId,commit.mId,commit.amount,commit.plan,
          commit.periodStart,commit.periodEnd,commit.paymentKey,commit.paymentKey
        ),
        db.prepare(`
          UPDATE billing_orders
          SET status=?,state_rank=?,payment_key=?,last_event_key=?,last_event_at=?
          WHERE order_id=? AND tenant_id=?
            -- State rank is NOT chronological: ACTIVE -> PAST_DUE is a
            -- legitimate separately verified downgrade. REFUNDED is terminal.
            AND status != 'REFUNDED'
            AND (status='PENDING' OR
                (status IN ('ACTIVE','PAST_DUE') AND last_event_at <= ?))
            AND (payment_key IS NULL OR payment_key=?)
            AND EXISTS (SELECT 1 FROM billing_events
                        WHERE event_key=? AND order_id=billing_orders.order_id
                        AND tenant_id=? AND payment_key=? AND status=? AND state_rank=?)
        `).bind(
          commit.status,rank,commit.paymentKey,commit.eventKey,commit.occurredAt,
          commit.orderId,commit.tenantId,commit.occurredAt,commit.paymentKey,
          commit.eventKey,commit.tenantId,commit.paymentKey,commit.status,rank
        ),
        db.prepare(`
          INSERT INTO billing_entitlements
            (tenant_id,order_id,payment_key,plan,status,state_rank,
             period_start,period_end,last_event_key,last_event_at,updated_at)
          SELECT o.tenant_id,o.order_id,o.payment_key,o.plan,o.status,o.state_rank,
                 o.period_start,o.period_end,o.last_event_key,o.last_event_at,?
          FROM billing_orders o
          WHERE o.order_id=? AND o.tenant_id=? AND o.last_event_key=?
          ON CONFLICT(tenant_id) DO UPDATE SET
            order_id=excluded.order_id,
            payment_key=excluded.payment_key,
            plan=excluded.plan,
            status=excluded.status,
            state_rank=excluded.state_rank,
            period_start=excluded.period_start,
            period_end=excluded.period_end,
            last_event_key=excluded.last_event_key,
            last_event_at=excluded.last_event_at,
            updated_at=excluded.updated_at
          WHERE excluded.period_start > billing_entitlements.period_start
             OR (excluded.period_start = billing_entitlements.period_start
                 AND billing_entitlements.status != 'REFUNDED'
                 AND excluded.last_event_at >= billing_entitlements.last_event_at
                 AND excluded.last_event_key != billing_entitlements.last_event_key)
        `).bind(createdAt,commit.orderId,commit.tenantId,commit.eventKey),
      ]);

      if (result[0]?.meta.changes !== 1) {
        // No matching immutable server order: all subsequent statements are
        // guarded by inserted eventKey; no user entitlement can be written.
        throw new BillingSecurityError('ORDER_BINDING_CHANGED');
      }
      return result[1]?.meta.changes === 1 ? 'APPLIED' : 'STALE';
    } catch (err) {
      if (isUniqueConflict(err)) {
        const previous = await db.prepare(
          `SELECT event_key,tenant_id,order_id,payment_key,status FROM billing_events
           WHERE event_key=? OR (order_id=? AND payment_key=? AND status=?) LIMIT 1`
        ).bind(
          commit.eventKey,commit.orderId,commit.paymentKey,commit.status
        ).first<EventRow>();
        if (previous && previous.order_id===commit.orderId &&
            previous.tenant_id===commit.tenantId &&
            previous.payment_key===commit.paymentKey &&
            previous.status===commit.status) {
          return 'DUPLICATE';
        }
        throw new BillingSecurityError('EVENT_KEY_COLLISION');
      }
      throw err;
    }
  }

  return { findOrder, applyVerified };
}

export async function readD1Entitlement(
  db: D1DatabaseLike, tenantId: string, nowMs: number = Date.now()
): Promise<{
  plan: 'FREE'|'STARTER'|'PRO';
  status: 'UNPAID'|'ACTIVE'|'PAST_DUE'|'REFUNDED'|'EXPIRED';
  periodEnd: number | null;
}> {
  const record = await db.prepare(
    `SELECT e.tenant_id,e.order_id,e.plan,e.status,e.period_end,e.payment_key,
       e.period_start FROM billing_entitlements e
       JOIN tenants t ON t.id=e.tenant_id
       WHERE e.tenant_id=? AND t.status='ACTIVE'`
  ).bind(tenantId).first<EntitlementRow>();
  if (!record) return { plan:'FREE', status:'UNPAID', periodEnd:null };
  if (record.period_start > nowMs) {
    return { plan:'FREE', status:'UNPAID', periodEnd:record.period_end };
  }
  if (record.period_end <= nowMs) {
    return { plan:'FREE', status:'EXPIRED', periodEnd:record.period_end };
  }
  if (record.status !== 'ACTIVE') {
    return { plan:'FREE', status:record.status, periodEnd:record.period_end };
  }
  return { plan:record.plan, status:'ACTIVE', periodEnd:record.period_end };
}
