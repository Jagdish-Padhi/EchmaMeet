import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import { buildApp, getAppServices } from './app';
import { moduleMigrations } from './module-migrations';
import { ConfigError, loadSettings } from './platform/config';
import { openDatabase } from './platform/db';
import { createShutdownRegistry, installProcessHandlers } from './platform/lifecycle';
import { createLogger } from './platform/logging';
import { runMigrations } from './platform/migrations';
import { createDistributedQueueManager } from './platform/queue';
import { attachCollaborationWebSocketBridge } from './platform/collaboration-ws';
import { attachVoiceWebSocketBridge } from './modules/voice';
import { authenticateToken } from './platform/auth';
import { systemClock } from './platform/system-clock';

const CLEANUP_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  const settings = loadSettings(process.env);
  const logger = createLogger(settings);

  // If DATABASE_URL is set (e.g. Neon PostgreSQL), log connection, otherwise use SQLite
  if (settings.databaseUrl) {
    logger.warn(
      'DATABASE_URL is set but this build persists to SQLite only; PostgreSQL is not supported.',
    );
  }
  const database = openDatabase(join(settings.dataDir, 'chaosboard.sqlite'));
  runMigrations(database, moduleMigrations, systemClock);

  const queueManager = createDistributedQueueManager(settings.redisUrl);
  if (queueManager.isDistributed) {
    logger.info('Connected to distributed BullMQ Redis queue');
  }

  const app = buildApp({
    logger,
    database,
    toxiproxyUrl: settings.toxiproxyUrl,
    partnerBaseUrl: settings.partnerBaseUrl,
    partnerApiKey: settings.partnerApiKey,
    partnerModelId: settings.partnerModelId,
    aiProvider: settings.aiProvider,
    metaApiKey: settings.metaApiKey,
    metaApiBaseUrl: settings.metaApiBaseUrl,
    metaSttMode: settings.metaSttMode,
    metaSamModelId: settings.metaSamModelId,
    repairModelId: settings.repairModelId,
    copilotModelId: settings.copilotModelId,
    visionModelId: settings.visionModelId,
    metaBudgetUsd: settings.metaBudgetUsd,
    metaReserveUsd: settings.metaReserveUsd,
    ice: {
      stunUrls: settings.stunUrls,
      turnUrls: settings.turnUrls,
      turnSharedSecret: settings.turnSharedSecret,
      turnTtlSeconds: settings.turnTtlSeconds,
    },
    toxiproxyUpstreamHost: settings.toxiproxyUpstreamHost,
    authConfig: {
      jwtSecret: settings.jwtSecret,
      jwtExpiresIn: settings.jwtExpiresIn,
      googleClientId: settings.googleClientId,
      firebaseProjectId: settings.firebaseProjectId,
      githubClientId: settings.githubClientId,
      githubClientSecret: settings.githubClientSecret,
    },
  });

  const webDistPath = join(import.meta.dirname, '../../web/dist');
  if (existsSync(webDistPath)) {
    await app.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    });
  }

  const shutdown = createShutdownRegistry({ logger, cleanupTimeoutMs: CLEANUP_TIMEOUT_MS });
  shutdown.register('database', () => {
    database.close();
  });
  shutdown.register('queue manager', () => queueManager.close());
  shutdown.register('http server', () => app.close());
  installProcessHandlers(process, shutdown, logger);

  await app.listen({ host: settings.host, port: settings.port });
  const services = getAppServices(app);
  attachCollaborationWebSocketBridge(app.server, {
    db: database,
    jwtSecret: settings.jwtSecret,
    rooms: services.rooms,
  });

  attachVoiceWebSocketBridge(app.server, services.voiceService, {
    authenticate: (token) => Boolean(authenticateToken(token, database, settings.jwtSecret)),
  });
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
