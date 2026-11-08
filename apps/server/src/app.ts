import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { registerTopologyRoutes, normalizeTopologyDraft } from './modules/topology';
import { createRunsService, registerRunsRoutes } from './modules/runs';
import { createChaosService } from './modules/chaos';
import { createMeasurementService } from './modules/measurement';
import { createExperimentOrchestrator, registerExperimentRoutes } from './modules/experiments';
import {
  OpenAiCompatibleAdapter,
  registerReasoningRoutes,
  type StructuredModelPort,
} from './modules/reasoning';
import { registerGnaniRoutes, type GnaniRuntime } from './modules/gnani';
import {
  MemoryVoiceLedger,
  registerVoiceLedgerRoutes,
  type VoiceLedgerPort,
} from './modules/voice-ledger';
import { createRepairOrchestrator, registerRepairRoutes } from './modules/repair';
import { createBenchmarkModule } from './modules/benchmarks';
import {
  decodePngRgba,
  inspectImageHeader,
  registerVisionRoutes,
  VisionService,
} from './modules/vision';
import { registerVoiceRoutes, VoiceService } from './modules/voice';
import { registerReportingRoutes, ReportingService } from './modules/reporting';
import { MeetingAgentService, registerMeetingRoutes } from './modules/meeting';
import type { RunId } from '@chaosboard/contracts';
import type { SqlDatabase } from './platform/db';
import { registerHealthRoute } from './platform/health';
import {
  DEFAULT_JWT_SECRET,
  installAuthGuard,
  registerAuthRoutes,
  signJwt,
  type AuthConfig,
} from './platform/auth';
import { registerProblemHandlers } from './platform/http-kit';
import type { Logger } from './platform/logging';

export interface AppDependencies {
  readonly logger: Logger;
  readonly database: SqlDatabase;
  readonly toxiproxyUrl?: string | undefined;
  readonly model?: StructuredModelPort | undefined;
  /** Gnani speech clients (Prisma STT, Timbre TTS). Absent capabilities degrade gracefully. */
  readonly gnani?: GnaniRuntime | undefined;
  readonly voiceLedger?: VoiceLedgerPort | undefined;
  readonly gnaniModels?: { readonly stt: string; readonly tts: string } | undefined;
  /** Optional OpenAI-compatible endpoint serving open-weight Gnani Evon. */
  readonly evon?:
    { readonly baseUrl: string; readonly apiKey: string; readonly modelId: string } | undefined;
  readonly authConfig?: AuthConfig | undefined;
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
  gnani,
  voiceLedger = new MemoryVoiceLedger(),
  gnaniModels = { stt: 'prisma-v3.0', tts: 'timbre-v2.5' },
  evon,
  authConfig,
}: AppDependencies): FastifyInstance {
  const baseLogger: FastifyBaseLogger = logger;
  const app = Fastify({ loggerInstance: baseLogger });
  registerProblemHandlers(app);

  registerHealthRoute(app, database);
  registerAuthRoutes(app, database, authConfig);
  installAuthGuard(app, database, authConfig);
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

  // The language model is optional. Without Evon every feature runs on the deterministic rule
  // engine and the trained ML diagnosis model.
  const modelClient: StructuredModelPort | undefined =
    model ??
    (evon?.baseUrl
      ? new OpenAiCompatibleAdapter({
          baseUrl: evon.baseUrl,
          apiKey: evon.apiKey,
          modelId: evon.modelId,
          providerName: 'evon',
        })
      : undefined);

  registerReasoningRoutes(app, {
    modelClient,
    provider: modelClient ? 'evon' : 'deterministic',
    modelId: evon?.modelId ?? '',
    baseUrl: evon?.baseUrl ?? '',
  });

  registerGnaniRoutes(app, {
    stt: gnani?.stt,
    tts: gnani?.tts,
    sttModel: gnaniModels.stt,
    ttsModel: gnaniModels.tts,
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

  const voiceService = new VoiceService({ stt: gnani?.stt, tts: gnani?.tts, ledger: voiceLedger });
  registerVoiceRoutes(app, voiceService);
  registerVoiceLedgerRoutes(app, voiceLedger);

  const reportingService = new ReportingService({
    getRunRecord: (runId) => Promise.resolve(runsService.getRun(runId as RunId) ?? null),
  });
  registerReportingRoutes(app, reportingService);

  const meetingAgentService = new MeetingAgentService(modelClient);
  registerMeetingRoutes(app, meetingAgentService, {
    stt: gnani?.stt,
    generateMediaToken: (userId, roomId) =>
      signJwt(
        { sub: userId, roomId, purpose: 'webrtc_media_signaling' },
        authConfig?.jwtSecret ?? DEFAULT_JWT_SECRET,
        7200,
      ),
  });

  (app as unknown as { voiceService: VoiceService }).voiceService = voiceService;

  return app;
}
