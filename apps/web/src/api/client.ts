import {
  healthResponseSchema,
  problemDetailsSchema,
  type HealthResponse,
  type ProblemDetails,
} from '@chaosboard/contracts';
import type { ZodType } from 'zod';

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

export interface ApiClient {
  getHealth(signal?: AbortSignal): Promise<HealthResponse>;
}

/**
 * Every response is parsed with its contract schema before the UI sees it. A response that does
 * not match the contract is reported as such, never passed through.
 */
export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const baseUrl = options.baseUrl ?? '';
  const fetchFn = options.fetchFn ?? ((...args) => fetch(...args));

  async function request<T>(path: string, schema: ZodType<T>, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try {
      response = await fetchFn(`${baseUrl}${path}`, signal === undefined ? {} : { signal });
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

  return {
    getHealth: (signal) => request('/api/health', healthResponseSchema, signal),
  };
}
