import { AppError, type ErrorKind } from '@chaosboard/shared';

export type GnaniFailure =
  | 'not_configured'
  | 'unauthorized'
  | 'rate_limited'
  | 'bad_request'
  | 'unsupported_audio'
  | 'timeout'
  | 'upstream';

export class GnaniError extends AppError {
  readonly failure: GnaniFailure;
  readonly retryable: boolean;
  readonly upstreamStatus: number | undefined;

  constructor(
    failure: GnaniFailure,
    message: string,
    options: { upstreamStatus?: number | undefined; cause?: unknown } = {},
  ) {
    const kind: ErrorKind =
      failure === 'timeout'
        ? 'timeout'
        : failure === 'bad_request' || failure === 'unsupported_audio'
          ? 'validation'
          : 'unavailable';
    super(kind, `gnani_${failure}`, message, { cause: options.cause });
    this.name = 'GnaniError';
    this.failure = failure;
    this.upstreamStatus = options.upstreamStatus;
    this.retryable = failure === 'rate_limited' || failure === 'timeout' || failure === 'upstream';
  }
}

interface ErrorEnvelope {
  readonly type?: string;
  readonly code?: string;
  readonly message?: string;
}

/** Gnani returns `{ success:false, error:{ type|code, message } }`; be tolerant of shape drift. */
export function parseErrorEnvelope(body: unknown): ErrorEnvelope {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const inner = record['error'];
    if (inner && typeof inner === 'object') {
      const e = inner as Record<string, unknown>;
      return {
        ...(typeof e['type'] === 'string' ? { type: e['type'] } : {}),
        ...(typeof e['code'] === 'string' ? { code: e['code'] } : {}),
        ...(typeof e['message'] === 'string' ? { message: e['message'] } : {}),
      };
    }
    if (typeof record['detail'] === 'string') return { message: record['detail'] };
    if (typeof record['message'] === 'string') return { message: record['message'] };
  }
  return {};
}

export function classifyHttpFailure(status: number, body: unknown): GnaniError {
  const env = parseErrorEnvelope(body);
  const label = env.type ?? env.code ?? `HTTP ${String(status)}`;
  const message = `Gnani API ${String(status)} ${label}${env.message ? `: ${env.message}` : ''}`;
  if (status === 401 || status === 403) {
    return new GnaniError('unauthorized', message, { upstreamStatus: status });
  }
  if (status === 429) return new GnaniError('rate_limited', message, { upstreamStatus: status });
  if (status === 504 || status === 408) {
    return new GnaniError('timeout', message, { upstreamStatus: status });
  }
  if (status >= 500) return new GnaniError('upstream', message, { upstreamStatus: status });
  return new GnaniError('bad_request', message, { upstreamStatus: status });
}
