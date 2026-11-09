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

export const voiceAnalyticsSchema = z.object({
  backend: z.enum(['postgres', 'memory']),
  total: z.number(),
  byLanguage: z.array(z.object({ language: z.string(), count: z.number() })),
  byStatus: z.array(z.object({ status: z.string(), count: z.number() })),
  byCommand: z.array(z.object({ command: z.string(), count: z.number() })),
  sttLatencyMs: z.object({ p50: z.number(), p95: z.number() }).nullable(),
  successRatePct: z.number().nullable(),
});
export type VoiceAnalytics = {
  backend: 'postgres' | 'memory';
  total: number;
  byLanguage: { language: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byCommand: { command: string; count: number }[];
  sttLatencyMs: { p50: number; p95: number } | null;
  successRatePct: number | null;
};

export const gnaniHealthSchema = z.object({
  status: z.enum(['configured', 'unconfigured']),
  speechToText: z.object({ provider: z.string(), model: z.string(), enabled: z.boolean() }),
  textToSpeech: z.object({ provider: z.string(), model: z.string(), enabled: z.boolean() }),
  message: z.string(),
});
export type GnaniHealth = z.infer<typeof gnaniHealthSchema>;

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
  createGuestSession(
    payload?: {
      name?: string | undefined;
      role?: string | undefined;
      email?: string | undefined;
    },
    signal?: AbortSignal,
  ): Promise<AuthSessionResponse>;
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
      provider: 'google' | 'github';
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
  resetExperimentLock(signal?: AbortSignal): Promise<{ status: string; message: string }>;
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
      /** `indic-auto` or BCP-47 codes such as `hi-IN,en-IN`. */
      language?: string | undefined;
      speakReply?: boolean | undefined;
      nodes: readonly { id: string; label: string }[];
      edges: readonly { id: string; source: string; target: string }[];
    },
    signal?: AbortSignal,
  ): Promise<VoiceIntentParseResult>;
  getVoiceAnalytics(signal?: AbortSignal): Promise<VoiceAnalytics>;
  getGnaniHealth(signal?: AbortSignal): Promise<GnaniHealth>;
  synthesizeSpeech(
    body: {
      text: string;
      language: string;
      voice?: string | undefined;
      speed?: number | undefined;
    },
    signal?: AbortSignal,
  ): Promise<Blob>;
  getReportMarkdown(runId: RunId, signal?: AbortSignal): Promise<string>;
  getReportJson(runId: RunId, signal?: AbortSignal): Promise<ReportExport>;
  getReportDiagramSvg(runId: RunId, signal?: AbortSignal): Promise<string>;
  getBlueprintCard(runId: RunId, signal?: AbortSignal): Promise<BlueprintCard>;
  sendMeetingTranscriptChunk(
    roomId: string,
    body: {
      chunkId: string;
      audioBase64: string;
      speakerId: string;
      speakerName: string;
      timestampMs: number;
      recordingConsent: boolean;
    },
    signal?: AbortSignal,
  ): Promise<{
    id: string;
    text: string;
    speakerName?: string | undefined;
    timestampMs?: number | undefined;
    latencyMs?: number | undefined;
  }>;
  getMeetingTranscripts(
    roomId: string,
    signal?: AbortSignal,
  ): Promise<{
    roomId: string;
    segments: readonly {
      id: string;
      roomId: string;
      speakerId: string;
      speakerName: string;
      text: string;
      timestampMs: number;
      durationMs: number;
    }[];
  }>;
  getMeetingAiOpinion(
    body: {
      topology: unknown;
      hostName?: string | undefined;
      userPrompt?: string | undefined;
      language?: string | undefined;
      roomId?: string | undefined;
      transcriptSegments?: readonly unknown[] | undefined;
      experimentSummary?: unknown;
    },
    signal?: AbortSignal,
  ): Promise<{
    handRaised: boolean;
    spokenOpinion: string;
    identifiedRisk?: string | undefined;
    supportingTranscriptReferences?: readonly unknown[] | undefined;
    affectedNodeIds?: readonly string[] | undefined;
    affectedEdgeIds?: readonly string[] | undefined;
    facts?: readonly string[] | undefined;
    assumptions?: readonly string[] | undefined;
    confidence?: number | undefined;
    proposedExperiment?: unknown;
    hazards: readonly unknown[];
    tokenUsage?:
      | {
          promptTokens?: number | undefined;
          completionTokens?: number | undefined;
          totalTokens?: number | undefined;
        }
      | undefined;
  }>;
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
      const token =
        typeof window !== 'undefined'
          ? (localStorage.getItem('chaosboard_token') ||
             localStorage.getItem('chaosboard_auth_token') ||
             sessionStorage.getItem('chaosboard_token') ||
             sessionStorage.getItem('chaosboard_auth_token'))
          : null;
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

    const isExemptFromAuthKickout =
      path.startsWith('/api/auth/') ||
      path.startsWith('/api/rooms/') ||
      path.startsWith('/api/meeting/') ||
      path.startsWith('/api/gnani/');

    if (response.status === 401 && !isExemptFromAuthKickout && typeof window !== 'undefined') {
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

      // Friendly fallback: if server returned standard error object with detail, message, or error
      const fallbackDetail =
        typeof body === 'object' && body !== null
          ? typeof (body as Record<string, unknown>)['detail'] === 'string'
            ? (body as Record<string, string>)['detail']
            : typeof (body as Record<string, unknown>)['message'] === 'string'
              ? (body as Record<string, string>)['message']
              : typeof (body as Record<string, unknown>)['error'] === 'string'
                ? (body as Record<string, string>)['error']
                : undefined
          : undefined;

      if (fallbackDetail) {
        throw new ApiError({
          kind: 'problem',
          problem: {
            type: 'about:blank',
            title:
              response.status === 400
                ? 'Bad Request'
                : response.status === 401
                  ? 'Unauthorized'
                  : response.status === 409
                    ? 'Conflict'
                    : 'Error',
            status: response.status,
            detail: fallbackDetail,
            code: 'error',
          },
        });
      }

      throw new ApiError({
        kind: 'unexpected_response',
        status: response.status,
        message: `HTTP error ${String(response.status)}`,
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

    createGuestSession: (payload, signal) =>
      request(
        '/api/auth/session',
        authSessionResponseSchema,
        withSignal('POST', signal, JSON.stringify(payload ?? {})),
      ),

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

    resetExperimentLock: (signal) =>
      request(
        '/api/experiments/reset-lock',
        z.object({ status: z.string(), message: z.string() }),
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

    getVoiceAnalytics: (signal) =>
      request('/api/voice/analytics', voiceAnalyticsSchema, withSignal('GET', signal)),

    getGnaniHealth: (signal) =>
      request('/api/gnani/health', gnaniHealthSchema, withSignal('GET', signal)),

    synthesizeSpeech: async (body, signal) => {
      const token =
        typeof window !== 'undefined'
          ? (localStorage.getItem('chaosboard_token') ||
             localStorage.getItem('chaosboard_auth_token') ||
             sessionStorage.getItem('chaosboard_token') ||
             sessionStorage.getItem('chaosboard_auth_token'))
          : null;
      const response = await fetchFn(`${baseUrl}/api/gnani/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        ...(signal ? { signal } : {}),
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error('[ApiClient] /api/gnani/tts failed:', response.status, errText);
        throw new Error(`Text-to-speech failed (${String(response.status)}): ${errText}`);
      }
      return response.blob();
    },

    getReportMarkdown: (runId, signal) =>
      requestText(`/api/reports/${runId}/markdown`, withSignal('GET', signal)),

    getReportJson: (runId, signal) =>
      request(`/api/reports/${runId}/json`, reportExportSchema, withSignal('GET', signal)),

    getReportDiagramSvg: (runId, signal) =>
      requestText(`/api/reports/${runId}/diagram`, withSignal('GET', signal)),

    getBlueprintCard: (runId, signal) =>
      request(`/api/reports/${runId}/card`, blueprintCardSchema, withSignal('GET', signal)),

    sendMeetingTranscriptChunk: (roomId, body, signal) =>
      request(
        `/api/rooms/${encodeURIComponent(roomId)}/transcript`,
        z.object({
          id: z.string(),
          text: z.string(),
          speakerName: z.string().optional(),
          timestampMs: z.number().optional(),
          latencyMs: z.number().optional(),
        }),
        withSignal('POST', signal, JSON.stringify(body)),
      ),

    getMeetingTranscripts: (roomId, signal) =>
      request(
        `/api/rooms/${encodeURIComponent(roomId)}/transcripts`,
        z.object({
          roomId: z.string(),
          segments: z.array(
            z.object({
              id: z.string(),
              roomId: z.string(),
              speakerId: z.string(),
              speakerName: z.string(),
              text: z.string(),
              timestampMs: z.number(),
              durationMs: z.number(),
            }),
          ),
        }),
        withSignal('GET', signal),
      ),

    getMeetingAiOpinion: (body, signal) =>
      request(
        '/api/meeting/ai-opinion',
        z.looseObject({
          handRaised: z.boolean(),
          spokenOpinion: z.string(),
          identifiedRisk: z.string().optional(),
          supportingTranscriptReferences: z.array(z.unknown()).optional(),
          affectedNodeIds: z.array(z.string()).optional(),
          affectedEdgeIds: z.array(z.string()).optional(),
          facts: z.array(z.string()).optional(),
          assumptions: z.array(z.string()).optional(),
          confidence: z.number().optional(),
          proposedExperiment: z.unknown().optional(),
          hazards: z.array(z.unknown()),
          tokenUsage: z
            .object({
              promptTokens: z.number().optional(),
              completionTokens: z.number().optional(),
              totalTokens: z.number().optional(),
            })
            .optional(),
        }),
        withSignal('POST', signal, JSON.stringify(body)),
      ),
  };
}
