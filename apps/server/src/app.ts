import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { registerTopologyRoutes } from './modules/topology';
import { createRunsService, registerRunsRoutes } from './modules/runs';
import { createChaosService } from './modules/chaos';
import { createMeasurementService } from './modules/measurement';
import { createExperimentOrchestrator, registerExperimentRoutes } from './modules/experiments';
import type { SqlDatabase } from './platform/db';
import { registerHealthRoute } from './platform/health';
import { registerProblemHandlers } from './platform/http-kit';
import type { Logger } from './platform/logging';

export interface AppDependencies {
  readonly logger: Logger;
  readonly database: SqlDatabase;
  readonly toxiproxyUrl?: string;
}

/**
 * Composition root for the HTTP application. This is where modules are mounted; modules never
 * mount themselves and never import each other's internals.
 */
export function buildApp({
  logger,
  database,
  toxiproxyUrl = 'http://127.0.0.1:8474',
}: AppDependencies): FastifyInstance {
  const baseLogger: FastifyBaseLogger = logger;
  const app = Fastify({ loggerInstance: baseLogger });
  registerProblemHandlers(app);

  registerHealthRoute(app, database);
  registerTopologyRoutes(app);

  const runsService = createRunsService(database);
  registerRunsRoutes(app, runsService);

  const chaosService = createChaosService(toxiproxyUrl, {
    upstreamHost: 'host.docker.internal',
  });
  const measurementService = createMeasurementService();
  const orchestrator = createExperimentOrchestrator({
    runs: runsService,
    chaos: chaosService,
    measurement: measurementService,
  });
  registerExperimentRoutes(app, orchestrator, runsService);

  return app;
}
