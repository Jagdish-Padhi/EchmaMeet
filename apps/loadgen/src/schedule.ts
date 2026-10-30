import { createSeededRandom } from '@chaosboard/shared';
import type { ArrivalProcess, TrialPhase } from '@chaosboard/contracts';

export interface ScheduledRequest {
  requestId: string;
  phase: TrialPhase;
  scheduledOffsetMs: number;
  runOffsetMs: number;
}

export interface ScheduleOptions {
  arrivalProcess: ArrivalProcess;
  arrivalRateRps: number;
  warmupDurationMs: number;
  measurementDurationMs: number;
  cooldownDurationMs: number;
  seed: number;
  requestIdPrefix?: string;
}

/**
 * Generates an open-loop schedule before execution begins.
 * Computes exact target send times from a seeded PRNG, preventing coordinated omission.
 */
export function generateSchedule(options: ScheduleOptions): ScheduledRequest[] {
  const {
    arrivalProcess,
    arrivalRateRps,
    warmupDurationMs,
    measurementDurationMs,
    cooldownDurationMs,
    seed,
    requestIdPrefix = 'req',
  } = options;

  const totalDurationMs = warmupDurationMs + measurementDurationMs + cooldownDurationMs;
  const measurementStartMs = warmupDurationMs;
  const measurementEndMs = warmupDurationMs + measurementDurationMs;

  const ratePerMs = arrivalRateRps / 1000;
  const items: ScheduledRequest[] = [];
  const rng = createSeededRandom(seed >>> 0);

  let currentRunOffsetMs = 0;
  let counter = 0;

  while (currentRunOffsetMs < totalDurationMs) {
    let intervalMs: number;

    if (arrivalProcess === 'constant') {
      intervalMs = 1000 / arrivalRateRps;
    } else {
      // Poisson process: exponentially distributed inter-arrival time
      const u = rng.next();
      // Clamp u strictly below 1 to avoid -Infinity from Math.log(0)
      const clampedU = Math.min(u, 0.999999999);
      intervalMs = -Math.log(1 - clampedU) / ratePerMs;
    }

    currentRunOffsetMs += intervalMs;
    if (currentRunOffsetMs >= totalDurationMs) {
      break;
    }

    let phase: TrialPhase;
    let scheduledOffsetMs: number;

    if (currentRunOffsetMs < measurementStartMs) {
      phase = 'warmup';
      scheduledOffsetMs = currentRunOffsetMs;
    } else if (currentRunOffsetMs < measurementEndMs) {
      phase = 'measurement';
      scheduledOffsetMs = currentRunOffsetMs - measurementStartMs;
    } else {
      phase = 'cooldown';
      scheduledOffsetMs = currentRunOffsetMs - measurementEndMs;
    }

    counter += 1;
    items.push({
      requestId: `${requestIdPrefix}-${String(counter).padStart(6, '0')}`,
      phase,
      scheduledOffsetMs,
      runOffsetMs: currentRunOffsetMs,
    });
  }

  return items;
}
