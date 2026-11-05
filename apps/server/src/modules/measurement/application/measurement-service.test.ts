import type { LoadgenSummary, WorkerCounters } from '@chaosboard/contracts';
import { describe, expect, it } from 'vitest';
import { MeasurementService } from './measurement-service';

const EDGE = 'a-to-b';

function counters(over: Partial<WorkerCounters>): WorkerCounters {
  return {
    requestsIn: 0,
    attemptsOut: { [EDGE]: 0 } as never,
    retries: 0,
    timeouts: 0,
    errorsByClass: {},
    breakerTransitions: { [EDGE]: 0 } as never,
    breakerOpenMs: { [EDGE]: 0 } as never,
    observedMs: 0,
    shedRequests: 0,
    ledgerDuplicates: 0,
    ...over,
  } as WorkerCounters;
}

const quiet = { minMs: 0, maxMs: 1, meanMs: 0.2, p50Ms: 0.2, p90Ms: 0.5, p99Ms: 0.8 };
const loadgenSummary = {
  sendLag: { p50Ms: 0, p90Ms: 0, p99Ms: 1, maxMs: 2 },
  eventLoopDelay: quiet,
} as unknown as LoadgenSummary;

function build(start: WorkerCounters, end: WorkerCounters) {
  return new MeasurementService().buildTrialResult({
    trialIndex: 0,
    seed: 1,
    records: [],
    startCounters: new Map([['svc-a', start]]),
    endCounters: new Map([['svc-a', end]]),
    workerSeries: new Map(),
    workerEventLoopDelays: new Map([['svc-a', quiet]]),
    nodeMaxWorkers: new Map(),
    edgeIds: [EDGE],
    loadgenSummary,
  } as never);
}

describe('breakerOpenFraction is measured from time spent open', () => {
  it('is open-time divided by the observed window, not a function of transition count', () => {
    const start = counters({});
    // Two transitions, but the breaker was open for only 1.5 s of a 6 s window.
    const end = counters({
      breakerTransitions: { [EDGE]: 2 } as never,
      breakerOpenMs: { [EDGE]: 1500 } as never,
      observedMs: 6000,
    });
    expect(build(start, end).metrics.breakerOpenFraction[EDGE as never]).toBeCloseTo(0.25, 6);

    // Same two transitions, open for 4.5 s: the metric moves with the duration.
    const longer = counters({
      breakerTransitions: { [EDGE]: 2 } as never,
      breakerOpenMs: { [EDGE]: 4500 } as never,
      observedMs: 6000,
    });
    expect(build(start, longer).metrics.breakerOpenFraction[EDGE as never]).toBeCloseTo(0.75, 6);
  });

  it('is exactly zero when the breaker never opened and clamps to one', () => {
    expect(
      build(counters({}), counters({ observedMs: 5000 })).metrics.breakerOpenFraction[
        EDGE as never
      ],
    ).toBe(0);
    expect(
      build(counters({}), counters({ breakerOpenMs: { [EDGE]: 9000 } as never, observedMs: 5000 }))
        .metrics.breakerOpenFraction[EDGE as never],
    ).toBe(1);
  });

  it('subtracts the starting counters so only this trial window is measured', () => {
    const start = counters({ breakerOpenMs: { [EDGE]: 1000 } as never, observedMs: 2000 });
    const end = counters({ breakerOpenMs: { [EDGE]: 1600 } as never, observedMs: 4000 });
    expect(build(start, end).metrics.breakerOpenFraction[EDGE as never]).toBeCloseTo(0.3, 6);
  });
});
