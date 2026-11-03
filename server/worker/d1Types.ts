/** Narrow Cloudflare D1 binding contract, allowing deterministic SQLite tests without SDK dependencies. */
export type SqlValue = string | number | null;

export interface D1StatementLike {
  bind(...values: SqlValue[]): D1StatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{results: T[]; success?: boolean}>;
  run(): Promise<{ success?: boolean; meta: { changes: number } }>;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1StatementLike;
  /** Cloudflare D1 batch is a single atomic SQL transaction; rollback on error. */
  batch(statements: D1StatementLike[]): Promise<Array<{
    success?: boolean;
    meta: { changes: number };
  }>>;
}
