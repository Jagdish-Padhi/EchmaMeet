import type { Clock } from '@chaosboard/shared';

export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefillMs: number;
  private readonly capacity: number;
  private readonly refillRatePerMs: number;

  constructor(
    rateRps: number,
    private readonly clock: Clock,
  ) {
    this.capacity = rateRps;
    this.refillRatePerMs = rateRps / 1000;
    this.tokens = this.capacity;
    this.lastRefillMs = clock.nowMs();
  }

  tryAcquire(cost = 1): boolean {
    this.refill();
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    return false;
  }

  private refill(): void {
    const now = this.clock.nowMs();
    const elapsedMs = Math.max(0, now - this.lastRefillMs);
    this.tokens = Math.min(this.capacity, this.tokens + elapsedMs * this.refillRatePerMs);
    this.lastRefillMs = now;
  }
}
