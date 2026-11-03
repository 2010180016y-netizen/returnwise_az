/**
 * Cloudflare Worker S3 API. No live billing, no payment authorisation call,
 * and NO unsigned payment webhooks granting entitlement.
 *
 * Existing public calculator remains on static Pages. This Worker is an
 * independent, disabled-by-default server API for later trusted integration.
 */
import type { D1DatabaseLike } from './d1Types';
import {
  authenticateBearer, revokeAuthenticatedSession, SessionAccessError,
  requireOwner,
} from './sessions';
import { createD1BillingLedger, readD1Entitlement } from '../billing/d1BillingLedger';
import { createTestTossPaymentLookup } from '../billing/tossPaymentLookup';
import { confirmTrustedPayment } from '../billing/verifiedConfirmation';
import { BillingSecurityError } from '../billing/verifiedBilling';
import { reconcileSandboxPayments } from '../billing/reconciliation';

export interface WorkerEnv {
  DB: D1DatabaseLike;
  BILLING_MODE?: string;
  S3_TEST_ONLY?: string;
  TOSS_TEST_API_SECRET?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store',
      'x-content-type-options':'nosniff',
      'referrer-policy':'no-referrer',
      'x-frame-options':'DENY',
    },
  });
}

function enabled(env: WorkerEnv): boolean {
  return env.BILLING_MODE==='test' && env.S3_TEST_ONLY==='yes';
}

async function parseJsonBody(req: Request): Promise<Record<string,unknown>> {
  if (req.headers.get('content-type')?.split(';')[0].trim()!=='application/json') {
    throw new BillingSecurityError('JSON_REQUIRED');
  }
  const body=await req.text();
  if (new TextEncoder().encode(body).length > 4096) {
    throw new BillingSecurityError('BODY_TOO_LARGE');
  }
  let parsed: unknown;
  try { parsed=JSON.parse(body); } catch { throw new BillingSecurityError('INVALID_JSON'); }
  if (!parsed || typeof parsed!=='object' || Array.isArray(parsed)) {
    throw new BillingSecurityError('INVALID_JSON');
  }
  return parsed as Record<string,unknown>;
}

async function handleRequest(req: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path==='/api/health' && req.method==='GET') {
    return json({ok:true, billing:'disabled-by-default'});
  }
  // PAYMENT_STATUS_CHANGED does not carry the v1 signature defined for
  // payout webhooks. Do not expose a public unsigned entitlement mutation.
  if (path==='/api/webhooks/toss') return json({error:'UNSUPPORTED_WEBHOOK'}, 410);

  if (!path.startsWith('/api/pro/')) return json({error:'NOT_FOUND'},404);
  if (!enabled(env)) return json({error:'BILLING_SERVICE_DISABLED'},503);

  const session = await authenticateBearer(env.DB, req.headers.get('authorization'));

  if(path==='/api/pro/entitlement' && req.method==='GET') {
    const entitlement=await readD1Entitlement(env.DB,session.tenantId);
    return json({entitlement});
  }

  if(path==='/api/pro/logout' && req.method==='POST') {
    await revokeAuthenticatedSession(env.DB,session);
    return json({ok:true});
  }

  if(path==='/api/pro/cases' && req.method==='GET') {
    const access=await readD1Entitlement(env.DB,session.tenantId);
    if(access.plan==='FREE') return json({error:'PRO_REQUIRED'},403);
    const {results}=await env.DB.prepare(
      `SELECT id,market,item_price,initial_shipping,return_shipping,
        commission_rate,best_option_code,cash_outflow,economic_cost,baseline_economic_cost,created_at
        FROM cases
        WHERE tenant_id=? AND is_deleted=0 AND retention_expires_at>?
        ORDER BY created_at DESC LIMIT 50`
    ).bind(session.tenantId,Date.now()).all();
    return json({cases:results ?? []});
  }

  if(path.startsWith('/api/pro/cases/') && req.method==='GET') {
    const access=await readD1Entitlement(env.DB,session.tenantId);
    if(access.plan==='FREE') return json({error:'PRO_REQUIRED'},403);
    const id=decodeURIComponent(path.slice('/api/pro/cases/'.length));
    if(!id || id.length>150) return json({error:'NOT_FOUND'},404);
    const data=await env.DB.prepare(
      `SELECT id,market,item_price,initial_shipping,return_shipping,
        commission_rate,best_option_code,cash_outflow,economic_cost,created_at
        FROM cases WHERE tenant_id=? AND id=? AND is_deleted=0
        AND retention_expires_at>?`
    ).bind(session.tenantId,id,Date.now()).first();
    return data?json({case:data}):json({error:'NOT_FOUND'},404);
  }

  if(path==='/api/pro/verify-payment' && req.method==='POST') {
    requireOwner(session);
    const input=await parseJsonBody(req);
    if(typeof input.orderId!=='string' || typeof input.paymentKey!=='string') {
      return json({error:'INVALID_PAYMENT_REQUEST'},400);
    }
    if(!env.TOSS_TEST_API_SECRET) return json({error:'TEST_PAYMENT_PROVIDER_NOT_CONFIGURED'},503);
    const ledger=createD1BillingLedger(env.DB);
    const lookup=createTestTossPaymentLookup({
      apiSecretKey:env.TOSS_TEST_API_SECRET,mode:'test',
    });
    const outcome=await confirmTrustedPayment(input.orderId,input.paymentKey,session,{
      ledger,lookup,sandboxEnabled:true,mode:'test',
    });
    return json(outcome);
  }

  return json({error:'NOT_FOUND'},404);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    try {
      return await handleRequest(request,env);
    } catch (error) {
      if(error instanceof SessionAccessError) {
        return json({error:error.code},error.statusCode);
      }
      if(error instanceof BillingSecurityError) {
        const status = error.code.includes('LOOKUP_FAILED')?503:403;
        return json({error:error.code},status);
      }
      // Do not echo raw payment keys, credentials, or SQL error messages.
      return json({error:'INTERNAL_ERROR'},500);
    }
  },

  async scheduled(_controller: unknown, env: WorkerEnv): Promise<void> {
    // No schedule is enabled in the committed config template. This handler
    // can only be used with explicit sandbox deployment configuration.
    if (!enabled(env) || !env.TOSS_TEST_API_SECRET) return;
    const lookup=createTestTossPaymentLookup({
      apiSecretKey:env.TOSS_TEST_API_SECRET,mode:'test',
    });
    const result=await reconcileSandboxPayments(env.DB,lookup);
    if (result.failed>0) {
      // Non-PII generic failure for Workers error monitoring.
      throw new Error('S3_RECONCILIATION_REQUIRES_RETRY');
    }
  },
};
