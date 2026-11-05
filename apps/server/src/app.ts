import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { registerTopologyRoutes, normalizeTopologyDraft } from './modules/topology';
import { createRunsService, registerRunsRoutes } from './modules/runs';
import { createChaosService } from './modules/chaos';
import { createMeasurementService } from './modules/measurement';
import { createExperimentOrchestrator, registerExperimentRoutes } from './modules/experiments';
import {
  MeteredModel,
  MeteredSam,
  MeteredVision,
  VOICE_USD_PER_HOUR,
  inspectWav,
  MuseVoiceTranscriber,
  OpenAiCompatibleAdapter,
  OpenAiVisionAdapter,
  SamSegmentationAdapter,
  UsageLedger,
  registerMetaAiRoutes,
  type StructuredModelPort,
} from './modules/meta-ai';
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
import { RoomRegistry } from './platform/rooms';
import type { IceSettings } from './platform/ice';

export interface AppDependencies {
  readonly logger: Logger;
  readonly database: SqlDatabase;
  readonly toxiproxyUrl?: string | undefined;
  readonly model?: StructuredModelPort | undefined;
  readonly partnerBaseUrl?: string | undefined;
  readonly partnerApiKey?: string | undefined;
  readonly partnerModelId?: string | undefined;
  readonly aiProvider?: string | undefined;
  readonly authConfig?: AuthConfig | undefined;
  /** Meta Model API key for capabilities outside the chat model (speech, segmentation). */
  readonly metaApiKey?: string | undefined;
  readonly metaApiBaseUrl?: string | undefined;
  readonly metaSttMode?: string | undefined;
  readonly metaSamModelId?: string | undefined;
  readonly repairModelId?: string | undefined;
  readonly copilotModelId?: string | undefined;
  readonly visionModelId?: string | undefined;
  readonly metaBudgetUsd?: number | undefined;
  readonly metaReserveUsd?: number | undefined;
  readonly ice?: IceSettings | undefined;
  readonly toxiproxyUpstreamHost?: string | undefined;
}

/** Long-lived services the process entrypoint needs after the app is built. */
export interface AppServices {
  readonly rooms: RoomRegistry;
  readonly voiceService: VoiceService;
  readonly usage: UsageLedger;
}

export function getAppServices(app: FastifyInstance): AppServices {
  return (app as unknown as { services: AppServices }).services;
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
  aiProvider,
  authConfig,
  metaApiKey = '',
  metaApiBaseUrl = 'https://api.meta.ai/v1',
  metaSttMode = 'ENDPOINTING',
  metaSamModelId = 'sam-3.1',
  repairModelId = '',
  copilotModelId = '',
  visionModelId = '',
  metaBudgetUsd = 150,
  metaReserveUsd = 40,
  ice = { stunUrls: [], turnUrls: [], turnSharedSecret: '', turnTtlSeconds: 3600 },
  toxiproxyUpstreamHost = process.env['TOXIPROXY_UPSTREAM_HOST'] ?? 'host.docker.internal',
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
    upstreamHost: toxiproxyUpstreamHost,
  });
  const measurementService = createMeasurementService();
  const experimentOrchestrator = createExperimentOrchestrator({
    runs: runsService,
    chaos: chaosService,
    measurement: measurementService,
  });
  registerExperimentRoutes(app, experimentOrchestrator, runsService);

  const usage = new UsageLedger(database, metaBudgetUsd, metaReserveUsd);
  const rooms = new RoomRegistry(database);

  // One adapter per distinct model id; each role (repair, copilot) can use a different model.
  const adapters = new Map<string, StructuredModelPort>();
  const adapterFor = (modelId: string): StructuredModelPort => {
    let adapter = adapters.get(modelId);
    if (!adapter) {
      adapter = new OpenAiCompatibleAdapter({
        baseUrl: partnerBaseUrl,
        apiKey: partnerApiKey,
        modelId,
      });
      adapters.set(modelId, adapter);
    }
    return adapter;
  };
  const metered = (
    inner: StructuredModelPort,
    capability: string,
    modelId: string,
  ): StructuredModelPort => new MeteredModel(inner, usage, capability, modelId);

  const defaultModel = model ?? adapterFor(partnerModelId);
  const modelClient = model ? defaultModel : metered(defaultModel, 'default', partnerModelId);
  const repairModel =
    model ??
    (repairModelId
      ? metered(adapterFor(repairModelId), 'repair', repairModelId)
      : metered(defaultModel, 'repair', partnerModelId));
  const copilotModel =
    model ??
    (copilotModelId
      ? metered(adapterFor(copilotModelId), 'copilot', copilotModelId)
      : metered(defaultModel, 'copilot', partnerModelId));

  registerMetaAiRoutes(app, {
    modelClient,
    provider: aiProvider ?? 'auto',
    modelId: partnerModelId,
    baseUrl: partnerBaseUrl,
    hasApiKey: Boolean(partnerApiKey),
  });

  // Honest capability report: what is wired to a real Meta endpoint, and what it has cost.
  app.get('/api/meta-ai/capabilities', () => ({
    chat: {
      provider: aiProvider ?? 'auto',
      baseUrl: partnerBaseUrl,
      defaultModelId: partnerModelId,
      repairModelId: repairModelId || partnerModelId,
      copilotModelId: copilotModelId || partnerModelId,
      configured: Boolean(partnerApiKey),
    },
    toolCallingRepairAgent: Boolean(partnerApiKey),
    segmentation: { modelId: metaSamModelId, configured: Boolean(metaApiKey) },
    speech: {
      modelId: 'muse-voice-transcribe-1.0',
      mode: metaSttMode,
      configured: Boolean(metaApiKey),
    },
    vision: { modelId: visionModelId || 'auto-by-endpoint', configured: Boolean(partnerApiKey) },
    usage: usage.summary(),
  }));
  app.get('/api/meta-ai/usage', () => usage.summary());

  const repairOrchestrator = createRepairOrchestrator({
    experiments: experimentOrchestrator,
    runs: runsService,
    model: repairModel,
    resolveToxiproxyVersion: () => chaosService.verifyConnection(),
  });
  registerRepairRoutes(app, repairOrchestrator, runsService);

  const benchmarks = createBenchmarkModule({
    experiments: experimentOrchestrator,
    runs: runsService,
    model: modelClient,
    repairOrchestrator,
  });
  benchmarks.registerRoutes(app);

  // Vision calls go through the same ledger as every other billable call.
  const visionAdapter = partnerApiKey
    ? new OpenAiVisionAdapter({
        baseUrl: partnerBaseUrl,
        apiKey: partnerApiKey,
        ...(visionModelId ? { modelId: visionModelId } : {}),
      })
    : undefined;
  const visionModel = visionAdapter
    ? new MeteredVision(visionAdapter, usage, visionAdapter.modelId)
    : undefined;

  // SAM 3.1 and Muse Voice Transcribe exist only when a Meta Model API key is configured.
  const samModel = metaApiKey
    ? new MeteredSam(
        new SamSegmentationAdapter({
          apiKey: metaApiKey,
          baseUrl: metaApiBaseUrl,
          modelId: metaSamModelId,
        }),
        usage,
        metaSamModelId,
      )
    : undefined;
  const speech = metaApiKey
    ? new MuseVoiceTranscriber({ apiKey: metaApiKey, baseUrl: metaApiBaseUrl, mode: metaSttMode })
    : undefined;
  /** Reserve, call, settle: the only path audio takes to Muse Voice Transcribe. */
  const transcribeMetered = async (wav: Buffer) => {
    if (!speech) throw new Error('Muse Voice Transcribe is not configured.');
    const info = inspectWav(wav);
    const reservation = usage.reserve(
      ((info?.durationMs ?? 120_000) / 3_600_000) * VOICE_USD_PER_HOUR,
    );
    try {
      const result = await speech.transcribeWav(wav);
      reservation.settle({
        capability: 'speech',
        provider: 'meta',
        modelId: result.modelId,
        audioMs: result.billedAudioMs,
        costUsd: (result.billedAudioMs / 3_600_000) * VOICE_USD_PER_HOUR,
        latencyMs: result.latencyMs,
      });
      return result;
    } catch (error) {
      reservation.release();
      throw error;
    }
  };

  const visionService = new VisionService({
    imageDecoder: {
      inspectHeader: inspectImageHeader,
      decodePixels: decodePngRgba,
    },
    normalizeTopologyDraft,
    visionModel,
    samModel,
  });
  registerVisionRoutes(app, visionService);

  const voiceService = new VoiceService({
    speechTranscription: speech
      ? {
          transcribeAudio: async (buffer) => {
            const result = await transcribeMetered(buffer);
            return { transcript: result.transcript, latencyMs: result.latencyMs };
          },
        }
      : undefined,
  });
  registerVoiceRoutes(app, voiceService);

  const reportingService = new ReportingService({
    getRunRecord: (runId) => Promise.resolve(runsService.getRun(runId as RunId) ?? null),
  });
  registerReportingRoutes(app, reportingService);

  const meetingAgentService = new MeetingAgentService(copilotModel);
  registerMeetingRoutes(app, meetingAgentService, {
    rooms,
    ice,
    generateMediaToken: (userId, roomId) =>
      signJwt(
        { sub: userId, roomId, purpose: 'webrtc_media_signaling' },
        authConfig?.jwtSecret ?? DEFAULT_JWT_SECRET,
        7200,
      ),
    loadExperimentEvidence: (runId) => {
      const run = runsService.getRun(runId as RunId);
      if (!run) return null;
      const faulted = run.faultedAggregate?.metrics;
      return {
        completionRate: faulted?.['completionRate']?.median,
        p99LatencyMs: faulted?.['p99LatencyMs']?.median,
        verdicts: run.verdicts.map((v) => ({
          invariantId: v.invariantId,
          status: v.status,
          reason: v.reason,
        })),
      };
    },
    transcriber: speech ? { transcribeWav: transcribeMetered } : undefined,
  });

  (app as unknown as { services: AppServices }).services = { rooms, voiceService, usage };

  return app;
}
