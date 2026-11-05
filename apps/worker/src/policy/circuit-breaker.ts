import type { BreakerPolicy } from '@chaosboard/contracts';
import type { Clock } from '@chaosboard/shared';

export type BreakerState = 'closed' | 'open' | 'half_open';

export class CircuitBreaker {
  private state: BreakerState = 'closed';
  private openedAtMs: number | null = null;
  private readonly window: boolean[] = []; // true = success, false = failure
  private halfOpenSuccesses = 0;
  private halfOpenInFlight = 0;
  private transitionCount = 0;
  /** Completed open intervals, in ms. The interval in progress is added on read. */
  private openAccumulatedMs = 0;

  constructor(
    private readonly policy: BreakerPolicy,
    private readonly clock: Clock,
  ) {}

  getState(): BreakerState {
    this.checkCooldown();
    return this.state;
  }

  getTransitionCount(): number {
    return this.transitionCount;
  }

  /**
   * Cumulative milliseconds this breaker has spent open.
   *
   * An open interval logically ends when its cooldown elapses, even though the state machine only
   * notices that lazily on the next request, so the in-progress interval is capped at the cooldown.
   */
  getOpenTimeMs(): number {
    if (this.state === 'open' && this.openedAtMs !== null) {
      const elapsed = this.clock.nowMs() - this.openedAtMs;
      return this.openAccumulatedMs + Math.min(Math.max(elapsed, 0), this.policy.cooldownMs);
    }
    return this.openAccumulatedMs;
  }

  canExecute(): boolean {
    if (!this.policy.enabled) {
      return true;
    }
    this.checkCooldown();
    if (this.state === 'closed') {
      return true;
    }
    if (this.state === 'open') {
      return false;
    }
    // half_open
    if (this.halfOpenInFlight + this.halfOpenSuccesses < this.policy.halfOpenProbes) {
      this.halfOpenInFlight++;
      return true;
    }
    return false;
  }

  recordResult(success: boolean): void {
    if (!this.policy.enabled) {
      return;
    }
    this.checkCooldown();

    if (this.state === 'closed') {
      this.window.push(success);
      if (this.window.length > this.policy.windowRequests) {
        this.window.shift();
      }

      if (this.window.length >= this.policy.windowRequests) {
        const failures = this.window.filter((res) => !res).length;
        const failurePct = (failures / this.window.length) * 100;
        if (failurePct >= this.policy.failureThresholdPct) {
          this.transitionTo('open');
        }
      }
      return;
    }

    if (this.state === 'half_open') {
      if (this.halfOpenInFlight > 0) {
        this.halfOpenInFlight--;
      }
      if (!success) {
        // Any failure in half-open immediately opens the breaker again
        this.transitionTo('open');
      } else {
        this.halfOpenSuccesses++;
        if (this.halfOpenSuccesses >= this.policy.halfOpenProbes) {
          this.transitionTo('closed');
        }
      }
    }
  }

  private checkCooldown(): void {
    if (this.state === 'open' && this.openedAtMs !== null) {
      const elapsed = this.clock.nowMs() - this.openedAtMs;
      if (elapsed >= this.policy.cooldownMs) {
        this.transitionTo('half_open');
      }
    }
  }

  private transitionTo(newState: BreakerState): void {
    if (this.state !== newState) {
      if (this.state === 'open' && this.openedAtMs !== null) {
        // Leaving 'open' (always via cooldown expiry): bank the interval, ending at the cooldown.
        const elapsed = this.clock.nowMs() - this.openedAtMs;
        this.openAccumulatedMs += Math.min(Math.max(elapsed, 0), this.policy.cooldownMs);
      }
      this.state = newState;
      this.transitionCount++;
      if (newState === 'open') {
        this.openedAtMs = this.clock.nowMs();
        this.window.length = 0;
        this.halfOpenInFlight = 0;
        this.halfOpenSuccesses = 0;
      } else if (newState === 'half_open') {
        this.openedAtMs = null;
        this.halfOpenInFlight = 0;
        this.halfOpenSuccesses = 0;
      } else {
        this.openedAtMs = null;
        this.window.length = 0;
        this.halfOpenInFlight = 0;
        this.halfOpenSuccesses = 0;
      }
    }
  }
}
