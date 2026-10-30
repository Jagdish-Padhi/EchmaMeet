import {
  benchmarkSuiteSummarySchema,
  cancelExperimentResponseSchema,
  healthResponseSchema,
  problemDetailsSchema,
  repairSessionRecordSchema,
  runEventSchema,
  runRecordSchema,
  scenarioSpecSchema,
  startExperimentResponseSchema,
  startRepairResponseSchema,
  validateTopologyResponseSchema,
  visionExtractionSchema,
  topologySchema,
  redStrokeDetectionResultSchema,
  voiceIntentParseResultSchema,
  type BenchmarkSuiteSummary,
  type CancelExperimentResponse,
  type HealthResponse,
  type ProblemDetails,
  type RepairSessionRecord,
  type RunEvent,
  type RunId,
  type RunRecord,
  type ScenarioId,
  type ScenarioSpec,
  type StartExperimentRequest,
  type StartExperimentResponse,
  type StartRepairRequest,
  type StartRepairResponse,
  type TopologyDraft,
  type Topology,
  type ValidateTopologyResponse,
  type VisionExtraction,
  type RedStrokeGestureRequest,
  type RedStrokeDetectionResult,
  type VoiceIntentParseResult,
} from '@chaosboard/contracts';
import { z, type ZodType } from 'zod';

export type ApiFailure =
  | { readonly kind: 'network'; readonly message: string }
  | { readonly kind: 'problem'; readonly problem: ProblemDetails }
  | { readonly kind: 'unexpected_response'; readonly status: number; readonly message: string };

export class ApiError extends Error {
  readonly failure: ApiFailure;

  constructor(failure: ApiFailure) {
    super(describeFailure(failure));
    this.name = 'ApiError';
    this.failure = failure;
  }
}

export function describeFailure(failure: ApiFailure): string {
  switch (failure.kind) {
    case 'network':
      return `The server could not be reached: ${failure.message}`;
    case 'problem':
      return `${failure.problem.title} (${failure.problem.code})${
        failure.problem.detail === undefined ? '' : `: ${failure.problem.detail}`
      }`;
    case 'unexpected_response':
      return `The server answered with status ${String(failure.status)}: ${failure.message}`;
  }
}

export interface ApiClientOptions {
  /** Empty means same origin, which is what both development (proxy) and production use. */
  readonly baseUrl?: string;
  readonly fetchFn?: typeof fetch;
}

export interface CancelRepairResponse {
  readonly repairId: RunId;
  readonly status: string;
}

const cancelRepairResponseSchema = z.object({
  repairId: z.string() as unknown as z.ZodType<RunId>,
  status: z.string(),
});

export interface ApiClient {
  getHealth(signal?: AbortSignal): Promise<HealthResponse>;
  validateTopology(draft: TopologyDraft, signal?: AbortSignal): Promise<ValidateTopologyResponse>;
  listScenarios(signal?: AbortSignal): Promise<readonly ScenarioSpec[]>;
  getScenario(id: ScenarioId, signal?: AbortSignal): Promise<ScenarioSpec>;
  startExperiment(
    request: StartExperimentRequest,
    signal?: AbortSignal,
  ): Promise<StartExperimentResponse>;
  getExperiment(id: RunId, signal?: AbortSignal): Promise<RunRecord>;
  cancelExperiment(id: RunId, signal?: AbortSignal): Promise<CancelExperimentResponse>;
  startRepair(request: StartRepairRequest, signal?: AbortSignal): Promise<StartRepairResponse>;
  getRepair(id: RunId, signal?: AbortSignal): Promise<RepairSessionRecord>;
  cancelRepair(id: RunId, signal?: AbortSignal): Promise<CancelRepairResponse>;
  listRuns(limit?: number, signal?: AbortSignal): Promise<readonly RunRecord[]>;
  getRun(id: RunId, signal?: AbortSignal): Promise<RunRecord>;
  getRunEvents(id: RunId, signal?: AbortSignal): Promise<readonly RunEvent[]>;
  exportRun(id: RunId, signal?: AbortSignal): Promise<RunRecord>;
  getBenchmarkResults(signal?: AbortSignal): Promise<BenchmarkSuiteSummary>;
  extractVisionDraft(
    imageBase64: string,
    mimeType?: string,
    signal?: AbortSignal,
  ): Promise<VisionExtraction>;
  confirmVisionDraft(draft: TopologyDraft, signal?: AbortSignal): Promise<Topology>;
  detectRedStrokeGesture(
    request: RedStrokeGestureRequest,
    signal?: AbortSignal,
  ): Promise<RedStrokeDetectionResult>;
  parseVoiceCommand(
    request: {
      transcript?: string | undefined;
      audioBase64?: string | undefined;
      audioDurationMs?: number | undefined;
      nodes: readonly { id: string; label: string }[];
      edges: readonly { id: string; source: string; target: string }[];
    },
    signal?: AbortSignal,
  ): Promise<VoiceIntentParseResult>;
}

/**
 * Every response is parsed with its contract schema before the UI sees it. A response that does
 * not match the contract is reported as such, never passed through.
 */
export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const baseUrl = options.baseUrl ?? '';
  const fetchFn = options.fetchFn ?? ((...args) => fetch(...args));

  async function request<T>(path: string, schema: ZodType<T>, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      const headers: Record<string, string> = {
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...((init.headers as Record<string, string> | undefined) ?? {}),
      };

      const requestInit: RequestInit = {
        ...init,
        headers,
      };

      response = await fetchFn(`${baseUrl}${path}`, requestInit);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      throw new ApiError({
        kind: 'network',
        message: error instanceof Error ? error.message : 'unknown network error',
      });
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiError({
        kind: 'unexpected_response',
        status: response.status,
        message: 'the response body was not valid JSON',
      });
    }

    if (!response.ok) {
      const problem = problemDetailsSchema.safeParse(body);
      if (problem.success) {
        throw new ApiError({ kind: 'problem', problem: problem.data });
      }
      throw new ApiError({
        kind: 'unexpected_response',
        status: response.status,
        message: 'the error response did not match the problem details contract',
      });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError({
        kind: 'unexpected_response',
        status: response.status,
        message: 'the response did not match the expected contract',
      });
    }
    return parsed.data;
  }

  const withSignal = (method: string, signal?: AbortSignal, body?: string): RequestInit => {
    const init: RequestInit = { method };
    if (signal !== undefined) {
      init.signal = signal;
    }
    if (body !== undefined) {
      init.body = body;
    }
    return init;
  };

  return {
    getHealth: (signal) => request('/api/health', healthResponseSchema, withSignal('GET', signal)),

    validateTopology: (draft, signal) =>
      request(
        '/api/topologies/validate',
        validateTopologyResponseSchema,
        withSignal('POST', signal, JSON.stringify(draft)),
      ),

    listScenarios: (signal) =>
      request('/api/scenarios', z.array(scenarioSpecSchema), withSignal('GET', signal)),

    getScenario: (id, signal) =>
      request(
        `/api/scenarios/${encodeURIComponent(id)}`,
        scenarioSpecSchema,
        withSignal('GET', signal),
      ),

    startExperiment: (req, signal) =>
      request(
        '/api/experiments',
        startExperimentResponseSchema,
        withSignal('POST', signal, JSON.stringify(req)),
      ),

    getExperiment: (id, signal) =>
      request(
        `/api/experiments/${encodeURIComponent(id)}`,
        runRecordSchema,
        withSignal('GET', signal),
      ),

    cancelExperiment: (id, signal) =>
      request(
        `/api/experiments/${encodeURIComponent(id)}/cancel`,
        cancelExperimentResponseSchema,
        withSignal('POST', signal),
      ),

    startRepair: (req, signal) =>
      request(
        '/api/repairs',
        startRepairResponseSchema,
        withSignal('POST', signal, JSON.stringify(req)),
      ),

    getRepair: (id, signal) =>
      request(
        `/api/repairs/${encodeURIComponent(id)}`,
        repairSessionRecordSchema,
        withSignal('GET', signal),
      ),

    cancelRepair: (id, signal) =>
      request(
        `/api/repairs/${encodeURIComponent(id)}/cancel`,
        cancelRepairResponseSchema,
        withSignal('POST', signal),
      ),

    listRuns: (limit = 50, signal) =>
      request(
        `/api/runs?limit=${String(limit)}`,
        z.array(runRecordSchema),
        withSignal('GET', signal),
      ),

    getRun: (id, signal) =>
      request(`/api/runs/${encodeURIComponent(id)}`, runRecordSchema, withSignal('GET', signal)),

    getRunEvents: (id, signal) =>
      request(
        `/api/runs/${encodeURIComponent(id)}/events`,
        z.array(runEventSchema),
        withSignal('GET', signal),
      ),

    exportRun: (id, signal) =>
      request(
        `/api/runs/${encodeURIComponent(id)}/export`,
        runRecordSchema,
        withSignal('GET', signal),
      ),

    getBenchmarkResults: (signal) =>
      request('/api/benchmarks/results', benchmarkSuiteSummarySchema, withSignal('GET', signal)),

    extractVisionDraft: (imageBase64, mimeType, signal) =>
      request(
        '/api/vision/extract',
        visionExtractionSchema,
        withSignal(
          'POST',
          signal,
          JSON.stringify({
            imageBase64,
            ...(mimeType ? { mimeType } : {}),
          }),
        ),
      ),

    confirmVisionDraft: (draft, signal) =>
      request(
        '/api/vision/confirm',
        topologySchema,
        withSignal('POST', signal, JSON.stringify({ draft })),
      ),

    detectRedStrokeGesture: (body, signal) =>
      request(
        '/api/vision/gesture',
        redStrokeDetectionResultSchema,
        withSignal('POST', signal, JSON.stringify(body)),
      ),

    parseVoiceCommand: (body, signal) =>
      request(
        '/api/voice/parse',
        voiceIntentParseResultSchema,
        withSignal('POST', signal, JSON.stringify(body)),
      ),
  };
}
