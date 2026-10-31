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
  reportExportSchema,
  blueprintCardSchema,
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
  type ReportExport,
  type BlueprintCard,
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

export interface UserSessionProfile {
  readonly userId: string;
  readonly name: string;
  readonly role: string;
  readonly avatar: string;
  readonly email?: string | undefined;
}

export interface AuthSessionResponse {
  readonly token: string;
  readonly user: UserSessionProfile;
}

const userSessionProfileSchema = z.object({
  userId: z.string(),
  name: z.string(),
  role: z.string(),
  avatar: z.string(),
  email: z.string().optional(),
});

const authSessionResponseSchema = z.object({
  token: z.string(),
  user: userSessionProfileSchema,
});

const currentUserResponseSchema = z.object({
  user: userSessionProfileSchema,
});

const logoutResponseSchema = z.object({
  success: z.boolean(),
});

const cancelRepairResponseSchema = z.object({
  repairId: z.string() as unknown as z.ZodType<RunId>,
  status: z.string(),
});

const authConfigResponseSchema = z.object({
  googleClientId: z.string().optional(),
  firebaseProjectId: z.string().optional(),
  githubClientId: z.string().optional(),
  providers: z.array(z.string()),
});

export type AuthConfigResponse = z.infer<typeof authConfigResponseSchema>;

export interface ApiClient {
  getHealth(signal?: AbortSignal): Promise<HealthResponse>;
  login(
    payload: { email: string; password: string },
    signal?: AbortSignal,
  ): Promise<AuthSessionResponse>;
  register(
    payload: {
      email: string;
      password: string;
      name?: string | undefined;
      role?: string | undefined;
    },
    signal?: AbortSignal,
  ): Promise<AuthSessionResponse>;
  sso(
    payload: {
      provider: 'google' | 'github' | 'meta';
      profile: {
        email: string;
        name: string;
        role?: string | undefined;
        avatar?: string | undefined;
      };
    },
    signal?: AbortSignal,
  ): Promise<AuthSessionResponse>;
  googleAuth(
    payload: {
      credential?: string | undefined;
      idToken?: string | undefined;
      accessToken?: string | undefined;
      profile?:
        | {
            email?: string | undefined;
            name?: string | undefined;
            avatar?: string | undefined;
          }
        | undefined;
    },
    signal?: AbortSignal,
  ): Promise<AuthSessionResponse>;
  githubAuth(
    payload: {
      code?: string | undefined;
      accessToken?: string | undefined;
      profile?:
        | {
            email?: string | undefined;
            name?: string | undefined;
            avatar?: string | undefined;
          }
        | undefined;
    },
    signal?: AbortSignal,
  ): Promise<AuthSessionResponse>;
  getAuthConfig(signal?: AbortSignal): Promise<AuthConfigResponse>;
  getCurrentUser(signal?: AbortSignal): Promise<{ user: UserSessionProfile }>;
  logout(signal?: AbortSignal): Promise<{ success: boolean }>;
  validateTopology(
    topology: Topology | TopologyDraft,
    signal?: AbortSignal,
  ): Promise<ValidateTopologyResponse>;
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
  getReportMarkdown(runId: RunId, signal?: AbortSignal): Promise<string>;
  getReportJson(runId: RunId, signal?: AbortSignal): Promise<ReportExport>;
  getReportDiagramSvg(runId: RunId, signal?: AbortSignal): Promise<string>;
  getBlueprintCard(runId: RunId, signal?: AbortSignal): Promise<BlueprintCard>;
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('chaosboard_token') : null;
      const headers: Record<string, string> = {
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
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

    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('chaosboard_token');
      localStorage.removeItem('chaosboard_auth');
      window.dispatchEvent(new Event('chaosboard:unauthorized'));
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        throw new ApiError({
          kind: 'unexpected_response',
          status: response.status,
          message: `The server answered with status ${String(response.status)}: the backend API server (http://127.0.0.1:8787) appears to be offline. Run 'pnpm dev' in your terminal to start both web and backend services.`,
        });
      }
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

  async function requestText(path: string, init: RequestInit = {}): Promise<string> {
    let response: Response;
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('chaosboard_token') : null;
      const headers: Record<string, string> = {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...((init.headers as Record<string, string> | undefined) ?? {}),
      };

      response = await fetchFn(`${baseUrl}${path}`, { ...init, headers });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      throw new ApiError({
        kind: 'network',
        message: error instanceof Error ? error.message : 'unknown network error',
      });
    }

    if (!response.ok) {
      throw new ApiError({
        kind: 'unexpected_response',
        status: response.status,
        message: `HTTP error ${String(response.status)}`,
      });
    }

    return response.text();
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

    login: (payload, signal) =>
      request(
        '/api/auth/login',
        authSessionResponseSchema,
        withSignal('POST', signal, JSON.stringify(payload)),
      ),

    register: (payload, signal) =>
      request(
        '/api/auth/register',
        authSessionResponseSchema,
        withSignal('POST', signal, JSON.stringify(payload)),
      ),

    sso: (payload, signal) =>
      request(
        '/api/auth/sso',
        authSessionResponseSchema,
        withSignal('POST', signal, JSON.stringify(payload)),
      ),

    googleAuth: (payload, signal) =>
      request(
        '/api/auth/google',
        authSessionResponseSchema,
        withSignal('POST', signal, JSON.stringify(payload)),
      ),

    githubAuth: (payload, signal) =>
      request(
        '/api/auth/github',
        authSessionResponseSchema,
        withSignal('POST', signal, JSON.stringify(payload)),
      ),

    getAuthConfig: (signal) =>
      request('/api/auth/config', authConfigResponseSchema, withSignal('GET', signal)),

    getCurrentUser: (signal) =>
      request('/api/auth/me', currentUserResponseSchema, withSignal('GET', signal)),

    logout: (signal) =>
      request('/api/auth/logout', logoutResponseSchema, withSignal('POST', signal)),

    validateTopology: (topologyOrDraft, signal) =>
      request(
        '/api/topologies/validate',
        validateTopologyResponseSchema,
        withSignal('POST', signal, JSON.stringify(topologyOrDraft)),
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

    getReportMarkdown: (runId, signal) =>
      requestText(`/api/reports/${runId}/markdown`, withSignal('GET', signal)),

    getReportJson: (runId, signal) =>
      request(`/api/reports/${runId}/json`, reportExportSchema, withSignal('GET', signal)),

    getReportDiagramSvg: (runId, signal) =>
      requestText(`/api/reports/${runId}/diagram`, withSignal('GET', signal)),

    getBlueprintCard: (runId, signal) =>
      request(`/api/reports/${runId}/card`, blueprintCardSchema, withSignal('GET', signal)),
  };
}
