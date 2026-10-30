import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

export type SqlParam = SQLInputValue;

/**
 * The narrow database surface modules may use. It wraps the SQLite driver so that swapping the
 * driver later touches this file only. The driver is synchronous; it blocks the control plane
 * event loop briefly per call, which is acceptable because the control plane is never on the
 * measured request path. Worker and load generator processes never touch the database.
 */
export interface SqlDatabase {
  exec(sql: string): void;
  run(sql: string, params?: readonly SqlParam[]): { readonly changes: number };
  /** Rows come back untyped; repositories parse them with a schema at this boundary. */
  get(sql: string, params?: readonly SqlParam[]): Record<string, unknown> | undefined;
  all(sql: string, params?: readonly SqlParam[]): Record<string, unknown>[];
  /** Runs `work` inside a transaction. It commits on return and rolls back if `work` throws. */
  transaction<T>(work: () => T): T;
  close(): void;
}

export const IN_MEMORY = ':memory:';

export function openDatabase(path: string): SqlDatabase {
  if (path !== IN_MEMORY) {
    mkdirSync(dirname(path), { recursive: true });
  }
  const database = new DatabaseSync(path);
  database.exec('PRAGMA foreign_keys = ON');
  database.exec('PRAGMA busy_timeout = 5000');
  if (path !== IN_MEMORY) {
    database.exec('PRAGMA journal_mode = WAL');
  }

  let depth = 0;
  return {
    exec(sql) {
      database.exec(sql);
    },
    run(sql, params = []) {
      const result = database.prepare(sql).run(...params);
      return { changes: Number(result.changes) };
    },
    get(sql, params = []) {
      return database.prepare(sql).get(...params);
    },
    all(sql, params = []) {
      return database.prepare(sql).all(...params);
    },
    transaction<T>(work: () => T): T {
      if (depth > 0) {
        throw new Error('Nested transactions are not supported.');
      }
      database.exec('BEGIN IMMEDIATE');
      depth += 1;
      try {
        const result = work();
        database.exec('COMMIT');
        return result;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      } finally {
        depth -= 1;
      }
    },
    close() {
      database.close();
    },
  };
}
