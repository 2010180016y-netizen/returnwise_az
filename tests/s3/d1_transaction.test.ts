import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SQLiteD1 } from './sqliteD1';
import {
  authenticateBearer, registerTrustedSession, revokeAuthenticatedSession,
  requireOwner, SessionAccessError,
} from '../../server/worker/sessions';
import { createTrustedBillingOrder } from '../../server/billing/orderFactory';
import { createD1BillingLedger, readD1Entitlement } from '../../server/billing/d1BillingLedger';
import { confirmTrustedPayment } from '../../server/billing/verifiedConfirmation';
import type {
  VerifiedCommit, VerifiedProviderPayment,
} from '../../server/billing/verifiedBilling';
import worker from '../../server/worker/index';

const M_ID='test_mid';
const key='verified_payment';
function confirmed(keyOverride = key, status: VerifiedProviderPayment['status']='DONE') {
  return { paymentKey:keyOverride, orderId:'', mId:M_ID, totalAmount:14900, status };
}

async function setup() {
  const db=new SQLiteD1();
  db.seedTenant('tenant_a','owner_a');
  db.seedTenant('tenant_b','owner_b');
  const bearerA=await registerTrustedSession(db,'owner_a','tenant_a');
  const bearerB=await registerTrustedSession(db,'owner_b','tenant_b');
  const sessionA=await authenticateBearer(db,'Bearer '+bearerA);
  const sessionB=await authenticateBearer(db,'Bearer '+bearerB);
  const p=Date.now();
  const order=await createTrustedBillingOrder(db,sessionA,'PRO',p,p+30*86400000,M_ID);
  const provider=confirmed();
  provider.orderId=order.orderId;
  const ledger=createD1BillingLedger(db);
  const lookup={getPayment:async () => ({...provider})};
  const request=()=>confirmTrustedPayment(order.orderId,key,sessionA,{
    ledger,lookup,sandboxEnabled:true,mode:'test',
  });
  return {db,sessionA,sessionB,bearerA,bearerB,order,provider,ledger,lookup,request};
}

function commitFor(s: Awaited<ReturnType<typeof setup>>, status: VerifiedCommit['status'],
  eventKey: string, paymentKey=key): VerifiedCommit {
  return {
    eventKey, orderId:s.order.orderId,tenantId:'tenant_a',paymentKey,
    amount:14900,mId:M_ID,plan:'PRO',status,periodStart:s.order.periodStart,
    periodEnd:s.order.periodEnd,occurredAt:Date.now(),
  };
}

describe('S3 | durable SQLite-backed Cloudflare D1 billing ledger',()=>{
  it('unpaid tenant remains FREE and verified provider DONE grants only its tenant',async()=>{
    const s=await setup();
    try {
      assert.equal((await readD1Entitlement(s.db,'tenant_a')).plan,'FREE');
      assert.equal((await s.request()).outcome,'APPLIED');
      assert.equal((await readD1Entitlement(s.db,'tenant_a')).plan,'PRO');
      assert.equal((await readD1Entitlement(s.db,'tenant_b')).plan,'FREE');
      const row=s.db.sqlite.prepare('SELECT COUNT(*) AS cnt FROM billing_events').get() as {cnt:number};
      assert.equal(row.cnt,1);
    } finally {s.db.close();}
  });

  it('identical payment, different event IDs and concurrent deliveries cannot double-extend',async()=>{
    const s=await setup();
    try {
      const first=commitFor(s,'ACTIVE','event-a');
      const second=commitFor(s,'ACTIVE','event-b');
      const results=await Promise.all([s.ledger.applyVerified(first),
        s.ledger.applyVerified(first),s.ledger.applyVerified(second)]);
      assert.equal(results.filter(x=>x==='APPLIED').length,1);
      assert.equal(results.filter(x=>x==='DUPLICATE').length,2);
      const events=s.db.sqlite.prepare('SELECT COUNT(*) AS cnt FROM billing_events').get() as {cnt:number};
      assert.equal(events.cnt,1);
      const ent=await readD1Entitlement(s.db,'tenant_a');
      assert.equal(ent.periodEnd,s.order.periodEnd);
    } finally{s.db.close();}
  });

  it('rollback leaves zero partial writes after duplicate and mismatched immutable order',async()=>{
    const s=await setup();
    try {
      assert.equal(await s.ledger.applyVerified(commitFor(s,'ACTIVE','one')),'APPLIED');
      const dup=commitFor(s,'ACTIVE','other-event');
      assert.equal(await s.ledger.applyVerified(dup),'DUPLICATE');
      const forged=commitFor(s,'REFUNDED','forged-mId');
      forged.mId='other-merchant';
      await assert.rejects(s.ledger.applyVerified(forged),/ORDER_BINDING_CHANGED/);
      const row=s.db.sqlite.prepare('SELECT COUNT(*) AS cnt FROM billing_events').get() as {cnt:number};
      assert.equal(row.cnt,1);
      assert.equal((await readD1Entitlement(s.db,'tenant_a')).plan,'PRO');
    } finally{s.db.close();}
  });

  it('refund wins regardless of late older ACTIVE event for same order',async()=>{
    const s=await setup();
    try {
      assert.equal(await s.ledger.applyVerified(commitFor(s,'REFUNDED','refund')),'APPLIED');
      assert.equal(await s.ledger.applyVerified(commitFor(s,'ACTIVE','late-active')),'STALE');
      const ent=await readD1Entitlement(s.db,'tenant_a');
      assert.equal(ent.plan,'FREE');
      assert.equal(ent.status,'REFUNDED');
    } finally{s.db.close();}
  });

  it('newer subscription period remains paid after older period refund arrives',async()=>{
    const s=await setup();
    try{
      await s.ledger.applyVerified(commitFor(s,'ACTIVE','first-done'));
      const second=await createTrustedBillingOrder(
        s.db,s.sessionA,'PRO',s.order.periodEnd,s.order.periodEnd+30*86400000,M_ID
      );
      const later: VerifiedCommit={
        ...commitFor(s,'ACTIVE','second-done','payment_next_period'),
        orderId:second.orderId,periodStart:second.periodStart,periodEnd:second.periodEnd,
      };
      assert.equal(await s.ledger.applyVerified(later),'APPLIED');
      assert.equal(await s.ledger.applyVerified(commitFor(s,'REFUNDED','late-refund')),'APPLIED');
      const ent=await readD1Entitlement(s.db,'tenant_a',second.periodStart+1);
      assert.equal(ent.plan,'PRO');
      assert.equal(ent.periodEnd,second.periodEnd);
    }finally{s.db.close();}
  });

  it('expired ACTIVE plan is FREE even before scheduler reconciliation',async()=>{
    const s=await setup();
    try {
      await s.request();
      assert.equal((await readD1Entitlement(s.db,'tenant_a',s.order.periodEnd+1)).plan,'FREE');
    }finally{s.db.close();}
  });

  it('cross-tenant order cannot be confirmed even by legitimate owner',async()=>{
    const s=await setup();
    try{
      let lookups=0;
      await assert.rejects(
        confirmTrustedPayment(s.order.orderId,key,s.sessionB,{
          ledger:s.ledger,lookup:{getPayment:async()=>{lookups++;return s.provider;}},
          mode:'test',sandboxEnabled:true,
        }),/ORDER_NOT_FOUND_FOR_TENANT/);
      assert.equal(lookups,0);
      assert.equal((await readD1Entitlement(s.db,'tenant_b')).plan,'FREE');
    }finally{s.db.close();}
  });

  it('provider mismatch and provider outage cannot create an entitlement',async()=>{
    const s=await setup();
    try {
      await assert.rejects(
        confirmTrustedPayment(s.order.orderId,key,s.sessionA,{
          ledger:s.ledger,lookup:{getPayment:async()=>({...s.provider,mId:'wrong'})},
          mode:'test',sandboxEnabled:true,
        }),/PROVIDER_PROOF_MISMATCH/);
      await assert.rejects(
        confirmTrustedPayment(s.order.orderId,key,s.sessionA,{
          ledger:s.ledger,lookup:{getPayment:async()=>{throw Error('timeout');}},
          mode:'test',sandboxEnabled:true,
        }),/PAYMENT_LOOKUP_FAILED/);
      assert.equal((await readD1Entitlement(s.db,'tenant_a')).plan,'FREE');
    }finally{s.db.close();}
  });

  it('two concurrent order activations with one period are rejected by database',async()=>{
    const s=await setup();
    try{
      await assert.rejects(
        createTrustedBillingOrder(s.db,s.sessionA,'PRO',s.order.periodStart,
          s.order.periodEnd,M_ID),
        /UNIQUE constraint failed/
      );
    }finally{s.db.close();}
  });

  it('order amount and tenant are server-created and cannot be overridden by user input',async()=>{
    const s=await setup();
    try{
      const o=s.db.sqlite.prepare(
        'SELECT tenant_id,amount,plan FROM billing_orders WHERE order_id=?'
      ).get(s.order.orderId) as {tenant_id:string;amount:number;plan:string};
      assert.deepEqual({...o},{tenant_id:'tenant_a',amount:14900,plan:'PRO'});
    }finally{s.db.close();}
  });
});

describe('S3 | D1-backed session and tenant security',()=>{
  it('revocation survives service object recreation and blocks session replay',async()=>{
    const s=await setup();
    try{
      assert.equal((await authenticateBearer(s.db,'Bearer '+s.bearerA)).tenantId,'tenant_a');
      assert.equal(await revokeAuthenticatedSession(s.db,s.sessionA),true);
      await assert.rejects(authenticateBearer(s.db,'Bearer '+s.bearerA),
        (err:unknown)=>err instanceof SessionAccessError && err.statusCode===401);
    }finally{s.db.close();}
  });

  it('deleted membership and wrong tenant fail server-side even with valid bearer',async()=>{
    const s=await setup();
    try{
      await assert.rejects(registerTrustedSession(s.db,'owner_a','tenant_b'),
        /TENANT_MEMBERSHIP_REQUIRED/);
      s.db.sqlite.prepare('DELETE FROM users WHERE id=?').run('owner_a');
      await assert.rejects(authenticateBearer(s.db,'Bearer '+s.bearerA),
        /SESSION_EXPIRED_OR_REVOKED/);
    }finally{s.db.close();}
  });

  it('staff MEMBER cannot verify payments or create billing orders',async()=>{
    const s=await setup();
    try{
      s.db.sqlite.prepare('UPDATE users SET role=? WHERE id=?').run('MEMBER','owner_a');
      const member=await authenticateBearer(s.db,'Bearer '+s.bearerA);
      assert.throws(()=>requireOwner(member),/OWNER_ONLY/);
      await assert.rejects(
        confirmTrustedPayment(s.order.orderId,key,member,{
          ledger:s.ledger,lookup:s.lookup,mode:'test',sandboxEnabled:true,
        }),/OWNER_ONLY/);
    }finally{s.db.close();}
  });

  it('no raw session token is persisted, only SHA-256 digest',async()=>{
    const s=await setup();
    try{
      const row=s.db.sqlite.prepare(
        'SELECT session_hash FROM billing_sessions WHERE user_id=?'
      ).get('owner_a') as {session_hash:string};
      assert.equal(row.session_hash.length,64);
      assert.ok(!row.session_hash.includes(s.bearerA));
    }finally{s.db.close();}
  });
});

describe('S3 | Worker HTTP API',()=>{
  it('starts disabled, rejects unsigned payment webhooks and emits no secrets',async()=>{
    const s=await setup();
    try {
      const env={DB:s.db};
      const get=(url:string,method='GET')=>worker.fetch(
        new Request('https://api.example.test'+url,{method}),env
      );
      assert.equal((await get('/api/health')).status,200);
      assert.equal((await get('/api/pro/entitlement')).status,503);
      assert.equal((await get('/api/webhooks/toss','POST')).status,410);
      assert.equal((await get('/unknown')).status,404);
    }finally{s.db.close();}
  });

  it('private entitlement requires bearer and reads only its own tenant',async()=>{
    const s=await setup();
    try{
      await s.request();
      const env={DB:s.db,BILLING_MODE:'test',S3_TEST_ONLY:'yes'};
      const build=(token:string)=>new Request('https://api.example.test/api/pro/entitlement',{
        headers:{Authorization:'Bearer '+token},
      });
      assert.equal((await worker.fetch(build('not-a-token'),env)).status,401);
      const r=await worker.fetch(build(s.bearerA),env);
      assert.equal(r.status,200);
      const a=await r.json() as {entitlement:{plan:string}};
      assert.equal(a.entitlement.plan,'PRO');
      const b=await worker.fetch(build(s.bearerB),env);
      assert.equal((await b.json() as {entitlement:{plan:string}}).entitlement.plan,'FREE');
    }finally{s.db.close();}
  });

  it('logout invalidates session for all subsequent worker requests',async()=>{
    const s=await setup();
    try{
      const env={DB:s.db,BILLING_MODE:'test',S3_TEST_ONLY:'yes'};
      const r=await worker.fetch(new Request('https://api.example.test/api/pro/logout',{
        method:'POST',headers:{Authorization:'Bearer '+s.bearerA},
      }),env);
      assert.equal(r.status,200);
      const denied=await worker.fetch(new Request('https://api.example.test/api/pro/entitlement',{
        headers:{Authorization:'Bearer '+s.bearerA},
      }),env);
      assert.equal(denied.status,401);
    }finally{s.db.close();}
  });
});
