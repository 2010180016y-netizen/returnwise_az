import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SQLiteD1 } from './sqliteD1';
import { registerTrustedSession, authenticateBearer } from '../../server/worker/sessions';
import { createTrustedBillingOrder } from '../../server/billing/orderFactory';
import { createD1BillingLedger, readD1Entitlement } from '../../server/billing/d1BillingLedger';
import { reconcileSandboxPayments } from '../../server/billing/reconciliation';
import type { BillingOrder, VerifiedCommit, VerifiedSubscriptionStatus, VerifiedProviderPayment } from '../../server/billing/verifiedBilling';

const TIER='PRO' as const;
async function setup() {
  const db=new SQLiteD1();
  db.seedTenant('tenant_reconcile','owner_reconcile');
  const token=await registerTrustedSession(db,'owner_reconcile','tenant_reconcile');
  const session=await authenticateBearer(db,'Bearer '+token);
  const ledger=createD1BillingLedger(db);
  const now=Date.now();
  return {db,session,ledger,now};
}
type Setup=Awaited<ReturnType<typeof setup>>;

async function newOrder(s:Setup,index:number) {
  const periodStart=s.now+index*60_000;
  return createTrustedBillingOrder(s.db,s.session,TIER,
    periodStart,periodStart+30*86400000,'test_mid');
}
function event(order:BillingOrder,status:VerifiedSubscriptionStatus,
  key:string,at:number,paymentKey='payment_a'):VerifiedCommit {
  return {
    eventKey:key,orderId:order.orderId,tenantId:order.tenantId,
    paymentKey,mId:order.mId,amount:order.amount,plan:order.plan,
    status,periodStart:order.periodStart,periodEnd:order.periodEnd,occurredAt:at,
  };
}

describe('P0 D1 billing status + fair reconciliation',()=>{
  it('accepts verified ACTIVE -> PAST_DUE without leaking paid entitlement',async()=>{
    const s=await setup();
    try{
      const o=await newOrder(s,0);
      assert.equal(await s.ledger.applyVerified(event(o,'ACTIVE','active-1',s.now)), 'APPLIED');
      assert.equal((await readD1Entitlement(s.db,o.tenantId,s.now+1)).plan,'PRO');
      assert.equal(await s.ledger.applyVerified(
        event(o,'PAST_DUE','provider-later-failed',s.now+1000)), 'APPLIED');
      const entitlement=await readD1Entitlement(s.db,o.tenantId,s.now+2000);
      assert.equal(entitlement.status,'PAST_DUE');
      assert.equal(entitlement.plan,'FREE');
      const row=s.db.sqlite.prepare(
        'SELECT status,last_event_at FROM billing_orders WHERE order_id=?'
      ).get(o.orderId) as {status:string;last_event_at:number};
      assert.equal(row.status,'PAST_DUE');
      assert.equal(row.last_event_at,s.now+1000);
    }finally{s.db.close();}
  });

  it('blocks older status events and never resurrects a refunded order',async()=>{
    const s=await setup();
    try{
      const o=await newOrder(s,0);
      assert.equal(await s.ledger.applyVerified(event(o,'ACTIVE','active-1',s.now+1000)),'APPLIED');
      assert.equal(await s.ledger.applyVerified(event(o,'PAST_DUE','stale-failure',s.now)),'STALE');
      assert.equal((await readD1Entitlement(s.db,o.tenantId,s.now+1)).plan,'PRO');
      assert.equal(await s.ledger.applyVerified(event(o,'REFUNDED','refund',s.now+2000)),'APPLIED');
      assert.equal(await s.ledger.applyVerified(event(o,'PAST_DUE','late-failure',s.now+3000)),'STALE');
      assert.equal((await readD1Entitlement(s.db,o.tenantId,s.now+3001)).plan,'FREE');
    }finally{s.db.close();}
  });

  it('never replaces a bound order payment key with unrelated verified payment',async()=>{
    const s=await setup();
    try{
      const o=await newOrder(s,0);
      await s.ledger.applyVerified(event(o,'ACTIVE','first',s.now));
      await assert.rejects(s.ledger.applyVerified(
        event(o,'REFUNDED','wrong-payment',s.now+1000,'other-key')),
        /ORDER_BINDING_CHANGED/);
      assert.equal((await readD1Entitlement(s.db,o.tenantId,s.now+1001)).plan,'PRO');
    }finally{s.db.close();}
  });

  it('reconciles 60 due orders in 50+10 batches rather than starving orders 51-60',async()=>{
    const s=await setup();
    try{
      const proofs=new Map<string,VerifiedProviderPayment>();
      for(let i=0;i<60;i++){
        const o=await newOrder(s,i);
        const key='key_'+i;
        assert.equal(await s.ledger.applyVerified(event(o,'ACTIVE','paid-'+i,s.now,key)),'APPLIED');
        proofs.set(key,{paymentKey:key,orderId:o.orderId,mId:o.mId,
          totalAmount:o.amount,status:'DONE'});
      }
      let lookups=0;
      const lookup={getPayment:async(key:string)=>{
        lookups++;
        const value=proofs.get(key);
        if(!value)throw new Error('missing provider proof');
        return value;
      }};
      const first=await reconcileSandboxPayments(s.db,lookup,s.now+1);
      const second=await reconcileSandboxPayments(s.db,lookup,s.now+1);
      const third=await reconcileSandboxPayments(s.db,lookup,s.now+1);
      assert.equal(first.scanned,50);
      assert.equal(second.scanned,10);
      assert.equal(third.scanned,0);
      assert.equal(first.failed+second.failed,0);
      assert.equal(lookups,60);
      const row=s.db.sqlite.prepare(
        'SELECT COUNT(*) AS cnt FROM billing_orders WHERE next_reconcile_at > ?'
      ).get(s.now+1) as {cnt:number};
      assert.equal(row.cnt,60);
    }finally{s.db.close();}
  });

  it('failed provider lookups are deferred and retried without granting rights',async()=>{
    const s=await setup();
    try{
      const o=await newOrder(s,0);
      await s.ledger.applyVerified(event(o,'ACTIVE','initial',s.now));
      const failure=await reconcileSandboxPayments(s.db,{
        getPayment:async()=>{throw new Error('provider offline');},
      },s.now+1);
      assert.equal(failure.scanned,1);
      assert.equal(failure.failed,1);
      const row=s.db.sqlite.prepare(
        'SELECT reconcile_attempts,next_reconcile_at FROM billing_orders WHERE order_id=?'
      ).get(o.orderId) as {reconcile_attempts:number;next_reconcile_at:number};
      assert.equal(row.reconcile_attempts,1);
      assert.equal(row.next_reconcile_at,s.now+1+300000);
      const skipped=await reconcileSandboxPayments(s.db,{
        getPayment:async()=>{throw new Error('should not be called');},
      },s.now+2);
      assert.equal(skipped.scanned,0);
      const recovered=await reconcileSandboxPayments(s.db,{
        getPayment:async()=>({
          paymentKey:'payment_a',orderId:o.orderId,mId:o.mId,totalAmount:o.amount,status:'CANCELED',
        }),
      },s.now+300002);
      assert.equal(recovered.scanned,1);
      assert.equal(recovered.updated,1);
      assert.equal((await readD1Entitlement(s.db,o.tenantId,s.now+300003)).plan,'FREE');
    }finally{s.db.close();}
  });
});
