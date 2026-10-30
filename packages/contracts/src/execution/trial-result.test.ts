import { describe, it, expect } from 'vitest';
import { edgeIdSchema, nodeIdSchema } from '../common/ids';
import { trialResultSchema, type TrialResult } from './trial-result';

const edge1 = edgeIdSchema.parse('edge-1');
const node1 = nodeIdSchema.parse('node-1');

describe('trialResultSchema', () => {
  const validTrialResult: TrialResult = {
    trialIndex: 0,
    seed: 12345,
    validity: {
      valid: true,
      reason: null,
    },
    metrics: {
      p99LatencyMs: 45.2,
      p50LatencyMs: 12.1,
      completionRate: 0.98,
      retryAmplification: { [edge1]: 1.15 },
      workerSaturation: { [node1]: 0.25 },
      maxQueueDepth: { [node1]: 3 },
      duplicateWriteRate: 0,
      breakerOpenFraction: { [edge1]: 0 },
    },
    diagnostics: {
      generatorLag: {
        minMs: 0.1,
        maxMs: 2.1,
        meanMs: 0.5,
        p50Ms: 0.4,
        p90Ms: 1.0,
        p99Ms: 1.9,
      },
      generatorEventLoopDelay: {
        minMs: 0.1,
        maxMs: 1.5,
        meanMs: 0.3,
        p50Ms: 0.2,
        p90Ms: 0.8,
        p99Ms: 1.2,
      },
      workerEventLoopDelays: {
        [node1]: {
          minMs: 0.1,
          maxMs: 1.8,
          meanMs: 0.4,
          p50Ms: 0.3,
          p90Ms: 0.9,
          p99Ms: 1.5,
        },
      },
      totalScheduledRequests: 100,
      totalCompletedRequests: 98,
    },
  };

  it('accepts valid trial results', () => {
    const parsed = trialResultSchema.parse(validTrialResult);
    expect(parsed.validity.valid).toBe(true);
    expect(parsed.metrics.completionRate).toBe(0.98);
  });

  it('accepts invalid trial results with reason', () => {
    const invalidResult: TrialResult = {
      ...validTrialResult,
      validity: {
        valid: false,
        reason: 'generator_lag_exceeded_limit: p99 lag was 15ms > 10ms',
      },
      metrics: {
        ...validTrialResult.metrics,
        p99LatencyMs: null,
      },
    };
    const parsed = trialResultSchema.parse(invalidResult);
    expect(parsed.validity.valid).toBe(false);
    expect(parsed.validity.reason).toContain('generator_lag_exceeded_limit');
  });

  it('rejects completion rate out of 0..1 bounds', () => {
    expect(() =>
      trialResultSchema.parse({
        ...validTrialResult,
        metrics: {
          ...validTrialResult.metrics,
          completionRate: 1.5,
        },
      }),
    ).toThrow();
  });
});
