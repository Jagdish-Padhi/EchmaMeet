import { GnaniError } from '../domain/errors';

export interface RetryOptions {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly random?: () => number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Retries only retryable GnaniErrors, with full-jitter exponential backoff. */
export async function withRetry<T>(work: () => Promise<T>, options: RetryOptions): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  let attempt = 0;
  for (;;) {
    try {
      return await work();
    } catch (error) {
      attempt += 1;
      const retryable = error instanceof GnaniError && error.retryable;
      if (!retryable || attempt >= options.maxAttempts) throw error;
      const ceiling = options.baseDelayMs * 2 ** (attempt - 1);
      await sleep(Math.floor(random() * ceiling));
    }
  }
}
