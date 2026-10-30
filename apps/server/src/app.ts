import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { registerTopologyRoutes, normalizeTopologyDraft } from './modules/topology';
import { createRunsService, registerRunsRoutes } from './modules/runs';
import { createChaosService } from './modules/chaos';
import { createMeasurementService } from './modules/measurement';
import { createExperimentOrchestrator, registerExperimentRoutes } from './modules/experiments';
import { OpenAiCompatibleAdapter, type StructuredModelPort } from './modules/meta-ai';
import { createRepairOrchestrator, registerRepairRoutes } from './modules/repair';
import { createBenchmarkModule } from './modules/benchmarks';
import {
  decodePngRgba,
  inspectImageHeader,
  registerVisionRoutes,
  VisionService,
} from './modules/vision';
import { registerVoiceRoutes, VoiceService } from './modules/voice';
import type { SqlDatabase } from './platform/db';
import { registerHealthRoute } from './platform/health';
import { registerProblemHandlers } from './platform/http-kit';
import type { Logger } from './platform/logging';

export interface AppDependencies {
  readonly logger: Logger;
  readonly database: SqlDatabase;
  readonly toxiproxyUrl?: string | undefined;
  readonly model?: StructuredModelPort | undefined;
  readonly partnerBaseUrl?: string | undefined;
  readonly partnerApiKey?: string | undefined;
  readonly partnerModelId?: string | undefined;
}

/**
 * Composition root for the HTTP application. This is where modules are mounted; modules never
 * mount themselves and never import each other's internals.
 */
export function buildApp({
  logger,
  database,
  toxiproxyUrl = 'http://127.0.0.1:8474',
  model,
  partnerBaseUrl = 'http://127.0.0.1:8000/v1',
  partnerApiKey = '',
  partnerModelId = 'meta-models/muse-spark-open-1026',
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
  const experimentOrchestrator = createExperimentOrchestrator({
    runs: runsService,
    chaos: chaosService,
    measurement: measurementService,
  });
  registerExperimentRoutes(app, experimentOrchestrator, runsService);

  const modelClient =
    model ??
    new OpenAiCompatibleAdapter({
      baseUrl: partnerBaseUrl,
      apiKey: partnerApiKey,
      modelId: partnerModelId,
    });

  const repairOrchestrator = createRepairOrchestrator({
    experiments: experimentOrchestrator,
    runs: runsService,
    model: modelClient,
  });
  registerRepairRoutes(app, repairOrchestrator, runsService);

  const benchmarks = createBenchmarkModule({
    experiments: experimentOrchestrator,
    runs: runsService,
    model: modelClient,
    repairOrchestrator,
  });
  benchmarks.registerRoutes(app);

  const visionService = new VisionService({
    imageDecoder: {
      inspectHeader: inspectImageHeader,
      decodePixels: decodePngRgba,
    },
    normalizeTopologyDraft,
  });
  registerVisionRoutes(app, visionService);

  const voiceService = new VoiceService({});
  registerVoiceRoutes(app, voiceService);

  return app;
}
