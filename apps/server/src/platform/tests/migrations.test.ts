import type { Clock } from '@chaosboard/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { IN_MEMORY, openDatabase, type SqlDatabase } from '../db';
import { MigrationError, runMigrations, type ModuleMigrations } from '../migrations';

const clock: Clock = { nowMs: () => Date.UTC(2026, 9, 28, 12, 0, 0), monotonicNs: () => 0n };

const alpha: ModuleMigrations = {
  module: 'alpha',
  migrations: [
    { version: 1, name: 'create-alpha', sql: 'CREATE TABLE alpha (id INTEGER PRIMARY KEY)' },
    { version: 2, name: 'add-alpha-note', sql: 'ALTER TABLE alpha ADD COLUMN note TEXT' },
  ],
};
const beta: ModuleMigrations = {
  module: 'beta',
  migrations: [
    { version: 1, name: 'create-beta', sql: 'CREATE TABLE beta (id INTEGER PRIMARY KEY)' },
  ],
};

describe('runMigrations', () => {
  const databases: SqlDatabase[] = [];

  function fresh(): SqlDatabase {
    const database = openDatabase(IN_MEMORY);
    databases.push(database);
    return database;
  }

  afterEach(() => {
    for (const database of databases.splice(0)) {
      database.close();
    }
  });

  it('applies every module from an empty database and records each migration', () => {
    const database = fresh();
    runMigrations(database, [alpha, beta], clock);
    const rows = database.all(
      'SELECT module, version, applied_at FROM schema_migrations ORDER BY module, version',
    );
    expect(rows.map((row) => `${String(row['module'])}:${String(row['version'])}`)).toEqual([
      'alpha:1',
      'alpha:2',
      'beta:1',
    ]);
    expect(rows[0]?.['applied_at']).toBe('2026-10-28T12:00:00.000Z');
    expect(database.all('SELECT * FROM alpha')).toEqual([]);
  });

  it('is idempotent', () => {
    const database = fresh();
    runMigrations(database, [alpha], clock);
    runMigrations(database, [alpha], clock);
    expect(database.all('SELECT * FROM schema_migrations')).toHaveLength(2);
  });

  it('applies only the pending migrations when a module gains a new one', () => {
    const database = fresh();
    runMigrations(database, [{ module: 'alpha', migrations: alpha.migrations.slice(0, 1) }], clock);
    runMigrations(database, [alpha], clock);
    expect(
      database.all('SELECT * FROM schema_migrations WHERE module = ?', ['alpha']),
    ).toHaveLength(2);
  });

  it('rolls back a failing migration and keeps earlier ones', () => {
    const database = fresh();
    const broken: ModuleMigrations = {
      module: 'gamma',
      migrations: [
        { version: 1, name: 'ok', sql: 'CREATE TABLE gamma (id INTEGER)' },
        { version: 2, name: 'bad', sql: 'CREATE TABLE half (id INTEGER); THIS IS NOT SQL' },
      ],
    };
    expect(() => {
      runMigrations(database, [broken], clock);
    }).toThrow(MigrationError);
    expect(
      database.all('SELECT version FROM schema_migrations WHERE module = ?', ['gamma']),
    ).toEqual([{ version: 1 }]);
    expect(database.get("SELECT name FROM sqlite_master WHERE name = 'half'")).toBeUndefined();
  });

  it('refuses a migration that was applied under a different name', () => {
    const database = fresh();
    runMigrations(database, [alpha], clock);
    const renamed: ModuleMigrations = {
      module: 'alpha',
      migrations: [{ version: 1, name: 'something-else', sql: alpha.migrations[0]?.sql ?? '' }],
    };
    expect(() => {
      runMigrations(database, [renamed], clock);
    }).toThrow(/applied as "create-alpha"/);
  });

  it('rejects versions that are not contiguous from 1', () => {
    const database = fresh();
    const gap: ModuleMigrations = {
      module: 'delta',
      migrations: [{ version: 2, name: 'skips-one', sql: 'CREATE TABLE delta (id INTEGER)' }],
    };
    expect(() => {
      runMigrations(database, [gap], clock);
    }).toThrow(/start at 1/);
  });
});
