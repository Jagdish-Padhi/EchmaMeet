import { describe, it, expect } from 'vitest';
import {
  computeLatencyPercentiles,
  computeCompletionRate,
  computeRetryAmplification,
  computeWorkerSaturation,
  computeMaxQueueDepth,
  computeDuplicateWriteRate,
} from '../metrics';
import {
  edgeIdSchema,
  nodeIdSchema,
  type LoadgenRecord,
  type WorkerCounters,
  type WorkerSeries,
} from '@chaosboard/contracts';

describe('measurement domain metrics', () => {
  const edge1 = edgeIdSchema.parse('edge-1');
  const serviceA = nodeIdSchema.parse('service-a');
  it('computes exact latency percentiles on completed requests in measurement phase', () => {
    const records: LoadgenRecord[] = [
      // Warmup record should be ignored
      {
        requestId: 'warm-1',
        phase: 'warmup',
        scheduledOffsetMs: 10,
        actualSendOffsetMs: 11,
        completedOffsetMs: 25,
        durationMs: 15,
        sendLagMs: 1,
        statusClass: 'success_2xx',
        httpStatus: 200,
        errorClass: null,
      },
      // 10 measurement records: durations 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
      ...Array.from({ length: 10 }, (_, i): LoadgenRecord => ({
        requestId: `req-${String(i + 1)}`,
        phase: 'measurement',
        scheduledOffsetMs: 100 + i * 10,
        actualSendOffsetMs: 101 + i * 10,
        completedOffsetMs: 100 + i * 10 + (i + 1) * 10,
        durationMs: (i + 1) * 10,
        sendLagMs: 1,
        statusClass: 'success_2xx',
        httpStatus: 200,
        errorClass: null,
      })),
    ];

    const percentiles = computeLatencyPercentiles(records);
    expect(percentiles.p50Ms).toBe(60);
    expect(percentiles.p90Ms).toBe(100);
    expect(percentiles.p99Ms).toBe(100);
  });

  it('computes completion rate correctly', () => {
    const records: LoadgenRecord[] = [
      {
        requestId: 'r1',
        phase: 'measurement',
        scheduledOffsetMs: 10,
        actualSendOffsetMs: 10,
        completedOffsetMs: 20,
        durationMs: 10,
        sendLagMs: 0,
        statusClass: 'success_2xx',
        httpStatus: 200,
        errorClass: null,
      },
      {
        requestId: 'r2',
        phase: 'measurement',
        scheduledOffsetMs: 20,
        actualSendOffsetMs: 20,
        completedOffsetMs: null,
        durationMs: null,
        sendLagMs: 0,
        statusClass: 'timeout',
        httpStatus: null,
        errorClass: 'TimeoutError',
      },
    ];

    expect(computeCompletionRate(records)).toBe(0.5);
  });

  it('computes retry amplification across start and end counters', () => {
    const startCounters: WorkerCounters = {
      requestsIn: 10,
      attemptsOut: { [edge1]: 10 },
      retries: 0,
      timeouts: 0,
      errorsByClass: {},
      breakerTransitions: {},
      shedRequests: 0,
      ledgerDuplicates: 0,
    };

    const endCounters: WorkerCounters = {
      requestsIn: 20, // 10 new requests
      attemptsOut: { [edge1]: 35 }, // 25 attempts sent
      retries: 15,
      timeouts: 10,
      errorsByClass: {},
      breakerTransitions: {},
      shedRequests: 0,
      ledgerDuplicates: 0,
    };

    // 25 / 10 = 2.5
    expect(computeRetryAmplification(startCounters, endCounters, edge1)).toBe(2.5);
  });

  it('computes worker saturation and max queue depth from series', () => {
    const series: WorkerSeries = {
      nodeId: serviceA,
      intervalMs: 100,
      samples: [
        { timestampMs: 100, queueDepth: 2, busyWorkers: 5 },
        { timestampMs: 200, queueDepth: 5, busyWorkers: 5 }, // saturated (5/5)
        { timestampMs: 300, queueDepth: 1, busyWorkers: 3 },
        { timestampMs: 400, queueDepth: 0, busyWorkers: 5 }, // saturated (5/5)
      ],
    };

    expect(computeWorkerSaturation(series, 5)).toBe(0.75); // 3 of 4 samples have busyWorkers >= 5
    expect(computeMaxQueueDepth(series)).toBe(5);
  });

  it('computes duplicate write rate at ledger sink', () => {
    const start: WorkerCounters = {
      requestsIn: 5,
      attemptsOut: {},
      retries: 0,
      timeouts: 0,
      errorsByClass: {},
      breakerTransitions: {},
      shedRequests: 0,
      ledgerDuplicates: 0,
    };

    const end: WorkerCounters = {
      requestsIn: 15, // 10 new requests
      attemptsOut: {},
      retries: 0,
      timeouts: 0,
      errorsByClass: {},
      breakerTransitions: {},
      shedRequests: 0,
      ledgerDuplicates: 3, // 3 duplicates
    };

    expect(computeDuplicateWriteRate(start, end)).toBe(0.3);
  });
});
