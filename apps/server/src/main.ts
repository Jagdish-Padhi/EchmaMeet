import { join } from 'node:path';
import { buildApp } from './app';
import { moduleMigrations } from './module-migrations';
import { ConfigError, loadSettings } from './platform/config';
import { openDatabase } from './platform/db';
import { createShutdownRegistry, installProcessHandlers } from './platform/lifecycle';
import { createLogger } from './platform/logging';
import { runMigrations } from './platform/migrations';
import { systemClock } from './platform/system-clock';

const CLEANUP_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  const settings = loadSettings(process.env);
  const logger = createLogger(settings);

  const database = openDatabase(join(settings.dataDir, 'chaosboard.sqlite'));
  runMigrations(database, moduleMigrations, systemClock);

  const app = buildApp({ logger, database, toxiproxyUrl: settings.toxiproxyUrl });

  const shutdown = createShutdownRegistry({ logger, cleanupTimeoutMs: CLEANUP_TIMEOUT_MS });
  shutdown.register('database', () => {
    database.close();
  });
  shutdown.register('http server', () => app.close());
  installProcessHandlers(process, shutdown, logger);

  await app.listen({ host: settings.host, port: settings.port });
}

main().catch((error: unknown) => {
  if (error instanceof ConfigError) {
    process.stderr.write(`${error.message}\n`);
  } else {
    process.stderr.write(
      `Startup failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
  process.exit(1);
});
