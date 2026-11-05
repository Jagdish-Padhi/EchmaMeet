import type { Clock } from '@chaosboard/shared';
import { describe, expect, it } from 'vitest';
import { TokenBucketRateLimiter } from '../rate-limiter';

class TestClock implements Clock {
  constructor(public currentMs = 1000) {}
  nowMs(): number {
    return this.currentMs;
  }
  monotonicNs(): bigint {
    return BigInt(this.currentMs) * 1_000_000n;
  }
  advance(ms: number): void {
    this.currentMs += ms;
  }
}

describe('TokenBucketRateLimiter', () => {
  it('allows bursts up to capacity and rejects once exhausted', () => {
    const clock = new TestClock(0);
    // 10 RPS = 10 capacity, 0.01 tokens/ms
    const limiter = new TokenBucketRateLimiter(10, clock);

    for (let i = 0; i < 10; i++) {
      expect(limiter.tryAcquire()).toBe(true);
    }
    // 11th should fail
    expect(limiter.tryAcquire()).toBe(false);
  });

  it('refills tokens over time at configured rate', () => {
    const clock = new TestClock(0);
    const limiter = new TokenBucketRateLimiter(10, clock);

    // Drain all 10 tokens
    for (let i = 0; i < 10; i++) {
      limiter.tryAcquire();
    }
    expect(limiter.tryAcquire()).toBe(false);

    // Advance 500ms -> should refill 5 tokens (10 RPS * 0.5s)
    clock.advance(500);
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryAcquire()).toBe(true);
    }
    expect(limiter.tryAcquire()).toBe(false);
  });

  it('caps tokens at capacity when idle', () => {
    const clock = new TestClock(0);
    const limiter = new TokenBucketRateLimiter(5, clock);

    // Advance 10 seconds without acquiring
    clock.advance(10_000);

    // Should only be able to acquire 5 (capacity)
    for (let i = 0; i < 5; i++) {
      expect(limiter.tryAcquire()).toBe(true);
    }
    expect(limiter.tryAcquire()).toBe(false);
  });
});
