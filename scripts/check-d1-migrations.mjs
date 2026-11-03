/**
 * Local-only P0 guard. D1 migrations apply every SQL file in migrations_dir,
 * so rollback SQL MUST NOT be discoverable there.
 * This script never connects to a remote database or executes destructive SQL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dirname = path.resolve('db/migrations');
const expected = [
  '0001_initial_schema.sql',
  '0002_cases_schema.sql',
  '0003_s3_billing_persistence.sql',
  '0004_billing_reconciliation_cursor.sql',
];
const actual = fs.readdirSync(dirname)
  .filter(name => name.toLowerCase().endsWith('.sql')).sort();

function requireSafe(condition, message) {
  if (!condition) throw new Error('D1_MIGRATION_UNSAFE: ' + message);
}

requireSafe(JSON.stringify(actual) === JSON.stringify(expected),
  'unexpected/missing migrations in automatic directory: ' + actual.join(','));

const db = new DatabaseSync(':memory:');
try {
  db.exec('PRAGMA foreign_keys = ON;');
  for (const name of actual) {
    const sql = fs.readFileSync(path.join(dirname, name), 'utf8');
    // Check executable SQL, not benign comments.
    const executable = sql.replace(/--[^\r\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    requireSafe(!/\b(?:DROP\s+(?:TABLE|INDEX|VIEW|TRIGGER)|TRUNCATE|DELETE\s+FROM|REPLACE\s+INTO)\b/i.test(executable),
      name + ' contains data-destructive or replacement SQL');
    db.exec(executable);
  }
  const tables = new Set(db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table'"
  ).all().map(row => row.name));
  for (const name of [
    'tenants','users','cases','billing_orders','billing_events',
    'billing_entitlements','billing_sessions',
  ]) requireSafe(tables.has(name),'table not created: '+name);

  const orderColumns = db.prepare("PRAGMA table_info('billing_orders')").all()
    .map(row => row.name);
  requireSafe(orderColumns.includes('next_reconcile_at') &&
    orderColumns.includes('reconcile_attempts'), 'reconciliation cursor columns missing');

  const entColumns = db.prepare("PRAGMA table_info('billing_entitlements')").all()
    .map(row => row.name);
  requireSafe(entColumns.includes('last_event_at'), 'entitlement event clock missing');
  const caseColumns = db.prepare("PRAGMA table_info('cases')").all()
    .map(row => row.name);
  requireSafe(caseColumns.includes('baseline_economic_cost'),
    'verified report reference field missing');
  requireSafe(fs.existsSync(path.resolve('db/manual_rollback/0002_cases_rollback.sql')),
    'manual rollback must be preserved outside automatic directory');

  console.log('P0 D1 migrations: SAFE allowlist, additive schema, SQLite execution PASS');
} finally {
  db.close();
}
