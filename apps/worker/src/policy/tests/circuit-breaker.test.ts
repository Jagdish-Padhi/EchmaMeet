import type { BreakerPolicy } from '@chaosboard/contracts';
import type { Clock } from '@chaosboard/shared';
import { describe, expect, it } from 'vitest';
import { CircuitBreaker } from '../circuit-breaker';

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

describe('CircuitBreaker', () => {
  const policy: BreakerPolicy = {
    enabled: true,
    failureThresholdPct: 50,
    windowRequests: 4,
    cooldownMs: 2000,
    halfOpenProbes: 2,
  };

  it('stays closed when failure threshold is not reached', () => {
    const clock = new TestClock();
    const breaker = new CircuitBreaker(policy, clock);

    expect(breaker.getState()).toBe('closed');
    expect(breaker.canExecute()).toBe(true);

    breaker.recordResult(true);
    breaker.recordResult(false);
    breaker.recordResult(true);
    breaker.recordResult(true);

    // 1 failure out of 4 = 25% < 50%
    expect(breaker.getState()).toBe('closed');
    expect(breaker.canExecute()).toBe(true);
    expect(breaker.getTransitionCount()).toBe(0);
  });

  it('opens when failure threshold is reached across the window', () => {
    const clock = new TestClock();
    const breaker = new CircuitBreaker(policy, clock);

    breaker.recordResult(true);
    breaker.recordResult(false);
    breaker.recordResult(false);
    breaker.recordResult(true); // 2 out of 4 = 50% >= 50%

    expect(breaker.getState()).toBe('open');
    expect(breaker.canExecute()).toBe(false);
    expect(breaker.getTransitionCount()).toBe(1);
  });

  it('transitions to half_open after cooldown, and closes on probe successes', () => {
    const clock = new TestClock();
    const breaker = new CircuitBreaker(policy, clock);

    // Open the breaker
    breaker.recordResult(false);
    breaker.recordResult(false);
    breaker.recordResult(false);
    breaker.recordResult(false);
    expect(breaker.getState()).toBe('open');

    // Before cooldown: still open
    clock.advance(1000);
    expect(breaker.getState()).toBe('open');
    expect(breaker.canExecute()).toBe(false);

    // After cooldown: transitions to half_open
    clock.advance(1000); // total 2000ms cooldown
    expect(breaker.getState()).toBe('half_open');
    expect(breaker.canExecute()).toBe(true); // First probe allowed
    expect(breaker.canExecute()).toBe(true); // Second probe allowed
    expect(breaker.canExecute()).toBe(false); // Max probes (2) in flight

    // Probes succeed
    breaker.recordResult(true);
    breaker.recordResult(true);

    // Now breaker should be closed
    expect(breaker.getState()).toBe('closed');
    expect(breaker.canExecute()).toBe(true);
  });

  it('re-opens immediately if a half-open probe fails', () => {
    const clock = new TestClock();
    const breaker = new CircuitBreaker(policy, clock);

    breaker.recordResult(false);
    breaker.recordResult(false);
    breaker.recordResult(false);
    breaker.recordResult(false);

    clock.advance(2000);
    expect(breaker.getState()).toBe('half_open');
    expect(breaker.canExecute()).toBe(true);

    // Probe fails
    breaker.recordResult(false);
    expect(breaker.getState()).toBe('open');
    expect(breaker.canExecute()).toBe(false);
  });

  it('always allows execution when breaker is disabled in policy', () => {
    const clock = new TestClock();
    const breaker = new CircuitBreaker({ ...policy, enabled: false }, clock);

    for (let i = 0; i < 10; i++) {
      breaker.recordResult(false);
    }
    expect(breaker.getState()).toBe('closed');
    expect(breaker.canExecute()).toBe(true);
    expect(breaker.getTransitionCount()).toBe(0);
  });

  describe('open-time measurement', () => {
    const failN = (breaker: CircuitBreaker, n: number) => {
      for (let i = 0; i < n; i += 1) {
        breaker.canExecute();
        breaker.recordResult(false);
      }
    };

    it('reports zero open time for a breaker that never opened', () => {
      const clock = new TestClock();
      const breaker = new CircuitBreaker(policy, clock);
      clock.advance(10_000);
      expect(breaker.getOpenTimeMs()).toBe(0);
    });

    it('accumulates time while open, capped at the cooldown even if nobody calls it', () => {
      const clock = new TestClock();
      const breaker = new CircuitBreaker(policy, clock);
      failN(breaker, 4); // opens
      expect(breaker.getState()).toBe('open');
      clock.advance(500);
      expect(breaker.getOpenTimeMs()).toBe(500);
      // Cooldown (2000 ms) expires with no traffic: the breaker has not noticed yet, but the
      // open interval is logically over.
      clock.advance(60_000);
      expect(breaker.getOpenTimeMs()).toBe(2000);
    });

    it('banks each completed open interval across repeated open/half-open cycles', () => {
      const clock = new TestClock();
      const breaker = new CircuitBreaker(policy, clock);
      failN(breaker, 4); // open #1
      clock.advance(2000);
      expect(breaker.getState()).toBe('half_open'); // transition banks 2000 ms
      breaker.canExecute();
      breaker.recordResult(false); // probe fails: open #2
      clock.advance(1200);
      expect(breaker.getOpenTimeMs()).toBe(2000 + 1200);
      clock.advance(5000);
      expect(breaker.getOpenTimeMs()).toBe(2000 + 2000);
    });
  });
});
