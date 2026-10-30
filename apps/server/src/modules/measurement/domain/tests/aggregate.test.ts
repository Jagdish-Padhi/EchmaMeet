import { describe, it, expect } from 'vitest';
import { computeMedianAndIQR, aggregateTrialResults } from '../aggregate';
import { edgeIdSchema, nodeIdSchema, type TrialResult } from '@chaosboard/contracts';

describe('measurement domain aggregation', () => {
  const edge1 = edgeIdSchema.parse('edge-1');
  const node1 = nodeIdSchema.parse('node-1');

  it('computes exact median and interquartile range', () => {
    // 5 values: 10, 20, 30, 40, 50
    // median = 30
    // p25 = 20, p75 = 40, iqr = 20
    const agg = computeMedianAndIQR([10, 20, 30, 40, 50]);
    expect(agg.median).toBe(30);
    expect(agg.p25).toBe(20);
    expect(agg.p75).toBe(40);
    expect(agg.iqr).toBe(20);
  });

  it('aggregates valid trials and separates invalid ones', () => {
    const makeTrial = (index: number, p99: number, valid = true): TrialResult => ({
      trialIndex: index,
      seed: 1000 + index,
      validity: {
        valid,
        reason: valid ? null : 'Excessive lag',
      },
      metrics: {
        p99LatencyMs: valid ? p99 : null,
        p50LatencyMs: valid ? p99 / 2 : null,
        completionRate: valid ? 0.95 : 0,
        retryAmplification: { [edge1]: 1.1 },
        workerSaturation: { [node1]: 0.2 },
        maxQueueDepth: { [node1]: 2 },
        duplicateWriteRate: 0,
        breakerOpenFraction: { [edge1]: 0 },
      },
      diagnostics: {
        generatorLag: { minMs: 0, maxMs: 1, meanMs: 0.5, p50Ms: 0.5, p90Ms: 0.8, p99Ms: 0.9 },
        generatorEventLoopDelay: {
          minMs: 0,
          maxMs: 1,
          meanMs: 0.2,
          p50Ms: 0.2,
          p90Ms: 0.5,
          p99Ms: 0.8,
        },
        workerEventLoopDelays: {},
        totalScheduledRequests: 50,
        totalCompletedRequests: valid ? 48 : 0,
      },
    });

    const trials: TrialResult[] = [
      makeTrial(0, 100),
      makeTrial(1, 120),
      makeTrial(2, 999, false), // invalid trial
      makeTrial(3, 140),
    ];

    const aggregated = aggregateTrialResults(trials);
    expect(aggregated.trialsCount).toBe(4);
    expect(aggregated.validTrialsCount).toBe(3);
    expect(aggregated.invalidTrialsCount).toBe(1);
    expect(aggregated.invalidReasons).toContain('Excessive lag');

    // Valid p99s: 100, 120, 140
    // median is 120
    expect(aggregated.metrics.p99LatencyMs.median).toBe(120);
    expect(aggregated.metrics.p99LatencyMs.p25).toBe(110);
    expect(aggregated.metrics.p99LatencyMs.p75).toBe(130);
    expect(aggregated.metrics.p99LatencyMs.iqr).toBe(20);
  });
});
