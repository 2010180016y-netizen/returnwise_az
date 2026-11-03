import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SQLiteD1 } from '../s3/sqliteD1';
import { registerTrustedSession, authenticateBearer } from '../../server/worker/sessions';
import { getTrustedQuotaUsage, reserveTrustedBatchRows, D1QuotaError } from '../../server/usage/d1Quota';
import worker from '../../server/worker/index';

const now=Date.now();

function insertCase(db:DatabaseSync,id:string,tenant:string,key:string|null,options?:{
  policyVerified?:number; isDeleted?:number;
}) {
  const sql=`INSERT INTO cases(
    id,tenant_id,idempotency_key,market,item_price,initial_shipping,
    return_shipping,commission_rate,best_option_code,cash_outflow,economic_cost,
    policy_verified,retention_expires_at,is_deleted,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  db.prepare(sql).run(id,tenant,key,'SMARTSTORE',30000,3000,3500,5.5,
    'C01',10000,9000,options?.policyVerified??0,now+86400000,
    options?.isDeleted??0,now,now);
}

describe('P1 D1 schema: tenant-isolated cases, fail-closed review and durable deletion',()=>{
  it('same idempotency request across tenants is allowed, same tenant duplicate rejected',()=>{
    const db=new SQLiteD1();
    try {
      db.seedTenant('org_a','owner_a');db.seedTenant('org_b','owner_b');
      insertCase(db.sqlite,'case1','org_a','shared-idempotency-key');
      insertCase(db.sqlite,'case2','org_b','shared-idempotency-key');
      assert.throws(()=>insertCase(db.sqlite,'case3','org_a','shared-idempotency-key'),
        /UNIQUE constraint failed/);
      assert.equal((db.sqlite.prepare(
        'SELECT COUNT(*) AS count FROM cases WHERE idempotency_key=?'
      ).get('shared-idempotency-key') as {count:number}).count,2);
    }finally{db.close();}
  });

  it('default policy_verified is zero and new rows have no implicit legal approval',()=>{
    const db=new SQLiteD1();
    try{
      db.seedTenant('org_a','owner_a');
      db.sqlite.prepare(`INSERT INTO cases(
        id,tenant_id,market,item_price,initial_shipping,return_shipping,
        commission_rate,best_option_code,cash_outflow,economic_cost,
        retention_expires_at,created_at,updated_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        'unreviewed','org_a','SMARTSTORE',30000,3000,3500,5.5,'REVIEW_REQUIRED',
        0,0,now+86400000,now,now);
      const row=db.sqlite.prepare('SELECT policy_verified FROM cases WHERE id=?')
        .get('unreviewed') as {policy_verified:number};
      assert.equal(row.policy_verified,0);
      assert.throws(()=>db.sqlite.prepare(
        'UPDATE cases SET policy_verified=5 WHERE id=?').run('unreviewed'),/CHECK constraint/);
    }finally{db.close();}
  });

  it('preserves legacy rows but revokes unverifiable prior default=1 and baseline claims',()=>{
    const db=new DatabaseSync(':memory:');
    try {
      db.exec('PRAGMA foreign_keys = ON;');
      for(const filename of [
        '0001_initial_schema.sql','0002_cases_schema.sql',
        '0003_s3_billing_persistence.sql','0004_billing_reconciliation_cursor.sql'
      ])db.exec(fs.readFileSync(path.resolve('db/migrations',filename),'utf8'));
      db.prepare('INSERT INTO tenants(id,name,plan,status,created_at,updated_at) VALUES(?,?,?,?,?,?)')
        .run('old_a','Legacy Shop','FREE','ACTIVE',now,now);
      // Legacy schema defaults to policy_verified=1 and previously could
      // fabricate a verified recommendation without explicit attestation.
      db.prepare(`INSERT INTO cases(
        id,tenant_id,idempotency_key,market,item_price,initial_shipping,return_shipping,
        commission_rate,best_option_code,cash_outflow,economic_cost,
        retention_expires_at,created_at,updated_at,baseline_economic_cost
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        'legacy1','old_a','once','COUPANG',25000,3000,3500,8.5,
        'C03',15000,12000,now+86400000,now,now,20000);
      db.exec(fs.readFileSync(
        path.resolve('db/migrations/0005_p1_tenant_cases_quota.sql'),'utf8'));
      const migrated=db.prepare(
        'SELECT policy_verified,best_option_code,baseline_economic_cost FROM cases WHERE id=?'
      ).get('legacy1') as {policy_verified:number;best_option_code:string;baseline_economic_cost:number|null};
      assert.deepEqual({...migrated},{
        policy_verified:0,best_option_code:'REVIEW_REQUIRED',baseline_economic_cost:null,
      });
      assert.equal((db.prepare('SELECT COUNT(*) AS n FROM cases_legacy_p1')
        .get() as {n:number}).n,1);
    }finally{db.close();}
  });

  it('soft-deleted, hard-deleted and imported tombstones cannot be resurrected',()=>{
    const db=new SQLiteD1();
    try {
      db.seedTenant('org_a','owner_a');
      insertCase(db.sqlite,'soft','org_a','softkey');
      db.sqlite.prepare('UPDATE cases SET is_deleted=1,updated_at=? WHERE id=?')
        .run(now+1,'soft');
      assert.throws(()=>db.sqlite.prepare(
        'UPDATE cases SET is_deleted=0 WHERE id=?').run('soft'),/CASE_TOMBSTONED/);
      db.sqlite.prepare('DELETE FROM cases WHERE id=?').run('soft');
      assert.throws(()=>insertCase(db.sqlite,'soft','org_a','softkey'),/CASE_TOMBSTONED/);
      insertCase(db.sqlite,'hard','org_a','hardkey');
      db.sqlite.prepare('DELETE FROM cases WHERE id=?').run('hard');
      assert.throws(()=>insertCase(db.sqlite,'hard','org_a','hardkey'),/CASE_TOMBSTONED/);
      assert.throws(()=>insertCase(db.sqlite,'new_case_id','org_a','hardkey'),/CASE_TOMBSTONED/);
      assert.equal((db.sqlite.prepare(
        'SELECT COUNT(*) AS n FROM case_tombstones WHERE tenant_id=?'
      ).get('org_a') as {n:number}).n,2);
    }finally{db.close();}
  });
});

async function seededQuota() {
  const db=new SQLiteD1();
  db.seedTenant('tenant_a','owner_a');
  db.seedTenant('tenant_b','owner_b');
  const bearerA=await registerTrustedSession(db,'owner_a','tenant_a');
  const bearerB=await registerTrustedSession(db,'owner_b','tenant_b');
  const ownerA=await authenticateBearer(db,'Bearer '+bearerA);
  const ownerB=await authenticateBearer(db,'Bearer '+bearerB);
  const periodStart=now-86400000;
  const periodEnd=now+15*86400000;
  for(const [tenant,plan] of [['tenant_a','STARTER'],['tenant_b','PRO']] as const) {
    const orderId='order_'+tenant;
    db.sqlite.prepare(`INSERT INTO billing_orders(
      order_id,tenant_id,m_id,amount,plan,period_start,period_end,
      status,state_rank,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(
      orderId,tenant,'test_mid',plan==='PRO'?14900:9900,plan,
      periodStart,periodEnd,'ACTIVE',2,now);
    db.sqlite.prepare(`INSERT INTO billing_entitlements(
      tenant_id,order_id,payment_key,plan,status,state_rank,
      period_start,period_end,last_event_key,updated_at,last_event_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(
      tenant,orderId,'payment_'+tenant,plan,'ACTIVE',2,periodStart,periodEnd,'verified_'+tenant,now,now);
  }
  return {db,bearerA,bearerB,ownerA,ownerB};
}

describe('P1 D1 quota: verified plan, atomic accounting and replay defense',()=>{
  it('charges a row reservation once despite same-id parallel requests',async()=>{
    const s=await seededQuota();
    try{
      const key='retry_same_batch_0001';
      const jobs=await Promise.all([
        reserveTrustedBatchRows(s.db,s.ownerA,key,70,now),
        reserveTrustedBatchRows(s.db,s.ownerA,key,70,now),
      ]);
      assert.deepEqual(jobs.map(x=>x.outcome).sort(),['DUPLICATE','RESERVED']);
      assert.equal((await getTrustedQuotaUsage(s.db,s.ownerA,now)).usedRows,70);
      await assert.rejects(
        reserveTrustedBatchRows(s.db,s.ownerA,key,71,now),
        (error:unknown)=>error instanceof D1QuotaError && error.code==='QUOTA_REPLAY_CONFLICT'
      );
    }finally{s.db.close();}
  });

  it('concurrent distinct requests never exceed Starter 100 row cap',async()=>{
    const s=await seededQuota();
    try {
      const responses=await Promise.allSettled([
        reserveTrustedBatchRows(s.db,s.ownerA,'parallel_batch_0001',60,now),
        reserveTrustedBatchRows(s.db,s.ownerA,'parallel_batch_0002',60,now),
      ]);
      assert.equal(responses.filter(x=>x.status==='fulfilled').length,1);
      assert.equal(responses.filter(x=>x.status==='rejected').length,1);
      assert.equal((await getTrustedQuotaUsage(s.db,s.ownerA,now)).usedRows,60);
    }finally{s.db.close();}
  });

  it('same request ID can be used by different tenants without cross-charge',async()=>{
    const s=await seededQuota();
    try{
      const key='shared_request_0001';
      const a=await reserveTrustedBatchRows(s.db,s.ownerA,key,12,now);
      const b=await reserveTrustedBatchRows(s.db,s.ownerB,key,200,now);
      assert.equal(a.outcome,'RESERVED');assert.equal(b.outcome,'RESERVED');
      assert.equal((await getTrustedQuotaUsage(s.db,s.ownerA,now)).usedRows,12);
      assert.equal((await getTrustedQuotaUsage(s.db,s.ownerB,now)).usedRows,200);
    }finally{s.db.close();}
  });

  it('revoked subscription blocks all future reservations even if used count exists',async()=>{
    const s=await seededQuota();
    try{
      await reserveTrustedBatchRows(s.db,s.ownerA,'before_revoke_0001',10,now);
      s.db.sqlite.prepare(
        "UPDATE billing_entitlements SET status='PAST_DUE' WHERE tenant_id='tenant_a'"
      ).run();
      await assert.rejects(
        reserveTrustedBatchRows(s.db,s.ownerA,'after_revoked_0001',10,now),
        (error:unknown)=>error instanceof D1QuotaError && error.code==='PAID_PLAN_REQUIRED'
      );
      const count=s.db.sqlite.prepare(
        "SELECT used_rows FROM quota_usage WHERE tenant_id='tenant_a'"
      ).get() as {used_rows:number};
      assert.equal(count.used_rows,10);
    }finally{s.db.close();}
  });

  it('blocks forged tenant sessions and revoked session tokens even with active paid entitlement',async()=>{
    const s=await seededQuota();
    try {
      await assert.rejects(
        reserveTrustedBatchRows(s.db,{...s.ownerA,tenantId:'tenant_b'},'forged_tenant_0001',10,now),
        (error:unknown)=>error instanceof D1QuotaError && error.code==='VERIFIED_SESSION_REQUIRED'
      );
      s.db.sqlite.prepare(
        "UPDATE billing_sessions SET revoked_at=? WHERE session_hash=?"
      ).run(now-1,s.ownerA.sessionHash);
      await assert.rejects(
        reserveTrustedBatchRows(s.db,s.ownerA,'revoked_token_0001',10,now),
        (error:unknown)=>error instanceof D1QuotaError && error.code==='VERIFIED_SESSION_REQUIRED'
      );
      assert.equal((s.db.sqlite.prepare(
        "SELECT COUNT(*) AS n FROM quota_reservations WHERE tenant_id='tenant_a'"
      ).get() as {n:number}).n,0);
    }finally{s.db.close();}
  });

  it('HTTP exposes authenticated GET usage but no unchecked batch consumption route',async()=>{
    const s=await seededQuota();
    try{
      const env={DB:s.db,BILLING_MODE:'test',S3_TEST_ONLY:'yes'};
      const request=(token:string,method='GET')=>worker.fetch(
        new Request('https://example.test/api/pro/quota',{
          method,headers:{Authorization:'Bearer '+token},
        }),env
      );
      const ok=await request(s.bearerA);
      assert.equal(ok.status,200);
      const data=await ok.json() as {usage:{plan:string;usedRows:number;limitRows:number}};
      assert.equal(data.usage.plan,'STARTER');
      assert.equal(data.usage.limitRows,100);
      assert.equal((await request('bad')).status,401);
      assert.equal((await request(s.bearerA,'POST')).status,404);
      assert.equal((await worker.fetch(
        new Request('https://example.test/api/pro/quota',{
          headers:{Authorization:'Bearer '+s.bearerA},
        }),{DB:s.db}
      )).status,503);
    }finally{s.db.close();}
  });
});
