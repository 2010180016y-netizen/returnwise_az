/** SQLite-backed D1 test double. Executes real SQL and atomic BEGIN/ROLLBACK. */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { D1DatabaseLike, D1StatementLike, SqlValue } from '../../server/worker/d1Types';

class Prepared implements D1StatementLike {
  constructor(
    public readonly parent: SQLiteD1,
    public readonly sql: string,
    public readonly params: SqlValue[] = []
  ) {}
  bind(...params: SqlValue[]): Prepared {
    return new Prepared(this.parent,this.sql,params);
  }
  async first<T = Record<string, unknown>>(): Promise<T|null> {
    const row=this.parent.sqlite.prepare(this.sql).get(...this.params);
    return (row ?? null) as T|null;
  }
  async all<T = Record<string, unknown>>(): Promise<{results: T[]; success: boolean}> {
    const rows=this.parent.sqlite.prepare(this.sql).all(...this.params);
    return {results: rows as T[], success:true};
  }
  async run(): Promise<{success:boolean;meta:{changes:number}}> {
    const info=this.parent.sqlite.prepare(this.sql).run(...this.params);
    return {success:true,meta:{changes:Number(info.changes)}};
  }
}

export class SQLiteD1 implements D1DatabaseLike {
  readonly sqlite = new DatabaseSync(':memory:');
  constructor() {
    this.sqlite.exec('PRAGMA foreign_keys=ON;');
    for(const name of [
      '0001_initial_schema.sql',
      '0002_cases_schema.sql',
      '0003_s3_billing_persistence.sql',
    ]) {
      const sql=fs.readFileSync(path.resolve('db/migrations',name),'utf8');
      this.sqlite.exec(sql);
    }
  }
  prepare(sql: string): Prepared {
    return new Prepared(this,sql);
  }
  private batchTail: Promise<void> = Promise.resolve();
  async batch(statements: D1StatementLike[]) {
    // D1 serializes transactions. A single SQLite connection in CI needs
    // an explicit FIFO queue; otherwise concurrent BEGIN calls overlap.
    const work = this.batchTail.then(async () => {
      const results: Array<{success?:boolean;meta:{changes:number}}> = [];
      this.sqlite.exec('BEGIN IMMEDIATE');
      try {
        for(const statement of statements) {
          const result=await statement.run();
          results.push(result);
        }
        this.sqlite.exec('COMMIT');
        return results;
      } catch(err) {
        this.sqlite.exec('ROLLBACK');
        throw err;
      }
    });
    this.batchTail = work.then(() => undefined, () => undefined);
    return work;
  }
  seedTenant(tenantId: string, userId: string, role: 'OWNER'|'MEMBER'='OWNER') {
    const now=Date.now();
    this.sqlite.prepare(
      'INSERT INTO tenants(id,name,plan,status,created_at,updated_at) VALUES(?,?,?,?,?,?)'
    ).run(tenantId,'Test Store','FREE','ACTIVE',now,now);
    this.sqlite.prepare(
      'INSERT INTO users(id,tenant_id,email,role,created_at) VALUES(?,?,?,?,?)'
    ).run(userId,tenantId,userId+'@example.test',role,now);
  }
  close() {this.sqlite.close();}
}
