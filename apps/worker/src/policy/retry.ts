import type { RetryPolicy } from '@chaosboard/contracts';
import type { RandomSource } from '@chaosboard/shared';

/**
 * Calculates the backoff delay in milliseconds for a retry attempt.
 *
 * @param retryIndex - 0-based retry count (0 for the first retry, 1 for second, etc.)
 * @param policy - The retry policy configuration
 * @param random - Injected random source for jitter calculation
 */
export function computeBackoffDelayMs(
  retryIndex: number,
  policy: RetryPolicy,
  random: RandomSource,
): number {
  if (policy.backoffBaseMs <= 0) {
    return 0;
  }

  const rawBackoff = policy.backoffBaseMs * Math.pow(policy.backoffMultiplier, retryIndex);
  const cappedBackoff = Math.min(rawBackoff, policy.maxBackoffMs);

  switch (policy.jitter) {
    case 'none':
      return Math.round(cappedBackoff);
    case 'full':
      return Math.floor(random.next() * cappedBackoff);
    case 'equal': {
      const half = cappedBackoff / 2;
      return Math.floor(half + random.next() * half);
    }
  }
}

/**
 * Determines whether a request can be retried given current attempts and maxAttempts.
 *
 * @param attemptsMade - Total attempts made so far (initial attempt is 1)
 * @param maxAttempts - Maximum attempts allowed by policy
 */
export function canRetry(attemptsMade: number, maxAttempts: number): boolean {
  return attemptsMade < maxAttempts;
}

