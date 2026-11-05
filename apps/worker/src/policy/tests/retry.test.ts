import type { RetryPolicy } from '@chaosboard/contracts';
import { createSeededRandom } from '@chaosboard/shared';
import { describe, expect, it } from 'vitest';
import { canRetry, computeBackoffDelayMs } from '../retry';

describe('computeBackoffDelayMs', () => {
  const basePolicy: RetryPolicy = {
    maxAttempts: 3,
    backoffBaseMs: 100,
    backoffMultiplier: 2,
    maxBackoffMs: 1000,
    jitter: 'none',
  };

  it('computes exact exponential backoff when jitter is none', () => {
    const random = createSeededRandom(42);
    // retryIndex 0 -> 100 * 2^0 = 100
    expect(computeBackoffDelayMs(0, basePolicy, random)).toBe(100);
    // retryIndex 1 -> 100 * 2^1 = 200
    expect(computeBackoffDelayMs(1, basePolicy, random)).toBe(200);
    // retryIndex 2 -> 100 * 2^2 = 400
    expect(computeBackoffDelayMs(2, basePolicy, random)).toBe(400);
    // retryIndex 3 -> 100 * 2^3 = 800
    expect(computeBackoffDelayMs(3, basePolicy, random)).toBe(800);
    // retryIndex 4 -> 100 * 2^4 = 1600 -> capped at 1000
    expect(computeBackoffDelayMs(4, basePolicy, random)).toBe(1000);
  });

  it('returns 0 if backoffBaseMs is 0', () => {
    const random = createSeededRandom(42);
    expect(computeBackoffDelayMs(1, { ...basePolicy, backoffBaseMs: 0 }, random)).toBe(0);
  });

  it('bounds delay between 0 and capped backoff when jitter is full', () => {
    const policy: RetryPolicy = { ...basePolicy, jitter: 'full' };
    const random = createSeededRandom(12345);
    for (let i = 0; i < 50; i++) {
      const delay = computeBackoffDelayMs(1, policy, random);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(200);
    }
  });

  it('bounds delay between half and capped backoff when jitter is equal', () => {
    const policy: RetryPolicy = { ...basePolicy, jitter: 'equal' };
    const random = createSeededRandom(12345);
    for (let i = 0; i < 50; i++) {
      const delay = computeBackoffDelayMs(1, policy, random);
      // capped is 200. half is 100. delay in [100, 200]
      expect(delay).toBeGreaterThanOrEqual(100);
      expect(delay).toBeLessThanOrEqual(200);
    }
  });

  it('determines if retry is allowed based on maxAttempts', () => {
    expect(canRetry(1, 3)).toBe(true);
    expect(canRetry(2, 3)).toBe(true);
    expect(canRetry(3, 3)).toBe(false);
    expect(canRetry(4, 3)).toBe(false);
  });
});
