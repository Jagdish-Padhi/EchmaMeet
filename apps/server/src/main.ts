import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import { buildApp } from './app';
import { moduleMigrations } from './module-migrations';
import { ConfigError, loadSettings } from './platform/config';
import { openDatabase } from './platform/db';
import { createShutdownRegistry, installProcessHandlers } from './platform/lifecycle';
import { createLogger } from './platform/logging';
import { runMigrations } from './platform/migrations';
import { createDistributedQueueManager } from './platform/queue';
import { attachCollaborationWebSocketBridge } from './platform/collaboration-ws';
import { attachVoiceWebSocketBridge, type VoiceService } from './modules/voice';
import { createGnaniRuntime } from './modules/gnani';
import { createVoiceLedger } from './modules/voice-ledger';
import { authenticateToken } from './platform/auth';
import { systemClock } from './platform/system-clock';

const CLEANUP_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  const settings = loadSettings(process.env);
  const logger = createLogger(settings);

  // Experiment state stays in embedded SQLite (deterministic, zero-latency for the chaos engine).
  // The voice ledger (command history, language and latency analytics) lives in PostgreSQL when
  // DATABASE_URL points at Neon or any Postgres, and in a bounded in-memory ring otherwise.
  const voiceLedger = await createVoiceLedger(settings.databaseUrl, (error) => {
    logger.error(
      { err: error instanceof Error ? error.message : String(error) },
      'PostgreSQL unavailable: falling back to the in-memory voice ledger',
    );
  });
  logger.info(
    { backend: voiceLedger.backend },
    voiceLedger.backend === 'postgres'
      ? 'Voice ledger connected to PostgreSQL (migrations applied)'
      : 'Voice ledger running in memory (set DATABASE_URL for PostgreSQL)',
  );
  const database = openDatabase(join(settings.dataDir, 'chaosboard.sqlite'));
  runMigrations(database, moduleMigrations, systemClock);

  const queueManager = createDistributedQueueManager(settings.redisUrl);
  if (queueManager.isDistributed) {
    logger.info('Connected to distributed BullMQ Redis queue');
  }

  const gnani = createGnaniRuntime({
    apiKey: settings.gnaniApiKey,
    baseUrl: settings.gnaniBaseUrl,
    sttModel: settings.gnaniSttModel,
    ttsModel: settings.gnaniTtsModel,
    ttsSampleRate: settings.gnaniTtsSampleRate,
  });
  logger.info(
    { stt: Boolean(gnani.stt), tts: Boolean(gnani.tts), sttModel: settings.gnaniSttModel },
    gnani.stt ? 'Gnani speech APIs enabled' : 'GNANI_API_KEY not set: voice features disabled',
  );

  const app = buildApp({
    logger,
    database,
    toxiproxyUrl: settings.toxiproxyUrl,
    gnani,
    voiceLedger,
    gnaniModels: { stt: settings.gnaniSttModel, tts: settings.gnaniTtsModel },
    evon: settings.evonBaseUrl
      ? {
          baseUrl: settings.evonBaseUrl,
          apiKey: settings.evonApiKey,
          modelId: settings.evonModelId,
        }
      : undefined,
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
  shutdown.register('voice ledger', () => voiceLedger.close());
  shutdown.register('queue manager', () => queueManager.close());
  shutdown.register('http server', () => app.close());
  installProcessHandlers(process, shutdown, logger);

  await app.listen({ host: settings.host, port: settings.port });
  attachCollaborationWebSocketBridge(app.server, {
    db: database,
    jwtSecret: settings.jwtSecret,
    validateRoomAccess: (userId, roomId) => {
      // Room isolation: authenticated user with non-empty roomId
      return Boolean(userId && roomId && roomId.length > 0);
    },
  });

  const voiceService = (app as unknown as { voiceService?: VoiceService }).voiceService;
  if (voiceService) {
    attachVoiceWebSocketBridge(app.server, voiceService, {
      authenticate: (token) => Boolean(authenticateToken(token, database, settings.jwtSecret)),
      realtime: gnani.realtime,
    });
  }
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
