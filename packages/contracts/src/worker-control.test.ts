import { describe, expect, it } from 'vitest';
import {
  workerCountersSchema,
  workerResetResponseSchema,
  workerSeriesSchema,
  workerShutdownResponseSchema,
  workerStatusSchema,
} from './worker-control';

describe('worker-control contracts', () => {
  it('validates workerCountersSchema', () => {
    const valid = {
      requestsIn: 100,
      attemptsOut: { 'e-1': 120 },
      retries: 20,
      timeouts: 5,
      errorsByClass: { '503': 3, '504': 2 },
      breakerTransitions: { 'e-1': 2 },
      shedRequests: 0,
      ledgerDuplicates: 1,
    };
    expect(workerCountersSchema.parse(valid)).toEqual(valid);

    // Rejects negative counters
    expect(() =>
      workerCountersSchema.parse({
        ...valid,
        requestsIn: -1,
      }),
    ).toThrow();

    // Rejects extra keys (strict)
    expect(() =>
      workerCountersSchema.parse({
        ...valid,
        unknownField: 1,
      }),
    ).toThrow();
  });

  it('validates workerStatusSchema', () => {
    const valid = {
      status: 'ready' as const,
      nodeId: 'worker-1',
      kind: 'service' as const,
      listenPort: 20001,
      uptimeMs: 1542.5,
      eventLoopDelay: {
        minMs: 0.1,
        maxMs: 5.2,
        meanMs: 0.8,
        p50Ms: 0.5,
        p90Ms: 1.2,
        p99Ms: 3.5,
      },
    };
    expect(workerStatusSchema.parse(valid)).toEqual(valid);

    expect(() =>
      workerStatusSchema.parse({
        ...valid,
        status: 'not_ready',
      }),
    ).toThrow();

    expect(() =>
      workerStatusSchema.parse({
        ...valid,
        listenPort: 50,
      }),
    ).toThrow();
  });

  it('validates workerSeriesSchema', () => {
    const valid = {
      nodeId: 'worker-1',
      intervalMs: 50,
      samples: [
        { timestampMs: 0, queueDepth: 0, busyWorkers: 1 },
        { timestampMs: 50, queueDepth: 2, busyWorkers: 5 },
      ],
    };
    expect(workerSeriesSchema.parse(valid)).toEqual(valid);

    expect(() =>
      workerSeriesSchema.parse({
        ...valid,
        intervalMs: 0,
      }),
    ).toThrow();
  });

  it('validates reset and shutdown response schemas', () => {
    expect(workerResetResponseSchema.parse({ status: 'ok', resetAtMs: 1000 })).toEqual({
      status: 'ok',
      resetAtMs: 1000,
    });

    expect(workerShutdownResponseSchema.parse({ status: 'shutting_down' })).toEqual({
      status: 'shutting_down',
    });
  });
});

