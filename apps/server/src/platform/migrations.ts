import type { Clock } from '@chaosboard/shared';
import { z } from 'zod';
import type { SqlDatabase } from './db';

export interface Migration {
  /** Starts at 1 and increases by exactly 1 within a module. */
  readonly version: number;
  readonly name: string;
  readonly sql: string;
}

export interface ModuleMigrations {
  readonly module: string;
  readonly migrations: readonly Migration[];
}

export class MigrationError extends Error {
  constructor(message: string, options?: { cause: unknown }) {
    super(message, options);
    this.name = 'MigrationError';
  }
}

const appliedRowSchema = z.object({ version: z.number().int(), name: z.string() });

/**
 * Applies pending migrations module by module, in the order given (callers pass modules in
 * dependency order). Each migration runs in its own transaction, so a failure leaves earlier
 * migrations applied and the failing one fully rolled back. A migration that was already
 * applied under a different name is treated as tampering and stops the run.
 */
export function runMigrations(
  database: SqlDatabase,
  modules: readonly ModuleMigrations[],
  clock: Clock,
): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      module TEXT NOT NULL,
      version INTEGER NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      PRIMARY KEY (module, version)
    )
  `);

  for (const { module, migrations } of modules) {
    migrations.forEach((migration, index) => {
      if (migration.version !== index + 1) {
        throw new MigrationError(
          `Module "${module}" has migration version ${String(migration.version)} at position ${String(index + 1)}. Versions must start at 1 and increase by 1.`,
        );
      }
    });

    const applied = new Map(
      appliedRowSchema
        .array()
        .parse(
          database.all('SELECT version, name FROM schema_migrations WHERE module = ?', [module]),
        )
        .map((row) => [row.version, row.name] as const),
    );

    for (const migration of migrations) {
      const appliedName = applied.get(migration.version);
      if (appliedName !== undefined) {
        if (appliedName !== migration.name) {
          throw new MigrationError(
            `Module "${module}" migration ${String(migration.version)} was applied as "${appliedName}" but is now named "${migration.name}".`,
          );
        }
        continue;
      }
      try {
        database.transaction(() => {
          database.exec(migration.sql);
          database.run(
            'INSERT INTO schema_migrations (module, version, name, applied_at) VALUES (?, ?, ?, ?)',
            [module, migration.version, migration.name, new Date(clock.nowMs()).toISOString()],
          );
        });
      } catch (error) {
        throw new MigrationError(
          `Module "${module}" migration ${String(migration.version)} ("${migration.name}") failed and was rolled back.`,
          { cause: error },
        );
      }
    }
  }
}
