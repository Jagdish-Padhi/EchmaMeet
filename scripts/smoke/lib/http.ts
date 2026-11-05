import { truncate } from './redact';

export interface TimedResponse {
  readonly status: number;
  readonly latencyMs: number;
  readonly headers: Record<string, string>;
  readonly body: string;
  readonly rateLimitHeaders: Record<string, string>;
}

const RATE_LIMIT_HEADER = /(ratelimit|rate-limit|retry-after|x-request-id)/i;

export class ProbeTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`No response from ${url} within ${String(timeoutMs)} ms.`);
    this.name = 'ProbeTimeoutError';
  }
}

/** One request with an explicit deadline. Never throws for HTTP error statuses; they are data. */
export async function timedFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  maxBodyChars = 20_000,
): Promise<TimedResponse> {
  const started = performance.now();
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ProbeTimeoutError(url, timeoutMs);
    }
    throw error;
  }
  const body = await response.text();
  const latencyMs = Math.round(performance.now() - started);
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  const rateLimitHeaders = Object.fromEntries(
    Object.entries(headers).filter(([name]) => RATE_LIMIT_HEADER.test(name)),
  );
  return {
    status: response.status,
    latencyMs,
    headers,
    body: truncate(body, maxBodyChars),
    rateLimitHeaders,
  };
}

export function median(values: readonly number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  const lower = sorted[middle - 1];
  if (upper === undefined) {
    return undefined;
  }
  return sorted.length % 2 === 1 || lower === undefined ? upper : (lower + upper) / 2;
}
