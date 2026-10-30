import { describe, it, expect } from 'vitest';
import { loadgenRecordSchema, type LoadgenRecord } from './loadgen-record';
import { loadgenSummarySchema, type LoadgenSummary } from './loadgen-summary';

describe('loadgenRecordSchema', () => {
  const validRecord: LoadgenRecord = {
    requestId: 'req-001',
    phase: 'measurement',
    scheduledOffsetMs: 100,
    actualSendOffsetMs: 102,
    completedOffsetMs: 125,
    durationMs: 25,
    sendLagMs: 2,
    statusClass: 'success_2xx',
    httpStatus: 200,
    errorClass: null,
  };

  it('accepts valid record lines', () => {
    const parsed = loadgenRecordSchema.parse(validRecord);
    expect(parsed.requestId).toBe('req-001');
    expect(parsed.durationMs).toBe(25);
  });

  it('accepts timeout and error records with null completion and status', () => {
    const timeoutRecord: LoadgenRecord = {
      requestId: 'req-timeout',
      phase: 'measurement',
      scheduledOffsetMs: 200,
      actualSendOffsetMs: 201,
      completedOffsetMs: null,
      durationMs: null,
      sendLagMs: 1,
      statusClass: 'timeout',
      httpStatus: null,
      errorClass: 'TimeoutError',
    };
    const parsed = loadgenRecordSchema.parse(timeoutRecord);
    expect(parsed.statusClass).toBe('timeout');
    expect(parsed.durationMs).toBeNull();
  });

  it('rejects unknown status classes', () => {
    expect(() =>
      loadgenRecordSchema.parse({
        ...validRecord,
        statusClass: 'unknown_class',
      }),
    ).toThrow();
  });

  it('rejects negative offsets', () => {
    expect(() =>
      loadgenRecordSchema.parse({
        ...validRecord,
        scheduledOffsetMs: -5,
      }),
    ).toThrow();
  });
});

describe('loadgenSummarySchema', () => {
  const validSummary: LoadgenSummary = {
    totalScheduled: 100,
    totalSent: 100,
    totalCompleted: 98,
    totalTimeouts: 2,
    totalErrors: 0,
    actualDurationMs: 2050,
    sendLag: {
      minMs: 0.1,
      maxMs: 4.2,
      meanMs: 0.8,
      p50Ms: 0.5,
      p90Ms: 1.5,
      p99Ms: 3.8,
    },
    eventLoopDelay: {
      minMs: 0.2,
      maxMs: 3.1,
      meanMs: 0.5,
      p50Ms: 0.4,
      p90Ms: 1.1,
      p99Ms: 2.5,
    },
  };

  it('accepts valid loadgen summaries', () => {
    const parsed = loadgenSummarySchema.parse(validSummary);
    expect(parsed.totalScheduled).toBe(100);
    expect(parsed.sendLag.p99Ms).toBe(3.8);
  });

  it('rejects negative counts or percentiles', () => {
    expect(() =>
      loadgenSummarySchema.parse({
        ...validSummary,
        totalScheduled: -1,
      }),
    ).toThrow();
  });
});
