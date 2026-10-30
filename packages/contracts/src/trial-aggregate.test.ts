import { describe, it, expect } from 'vitest';
import { edgeIdSchema, nodeIdSchema } from './ids';
import { trialAggregateSchema, type TrialAggregate } from './trial-aggregate';

const edge1 = edgeIdSchema.parse('edge-1');
const node1 = nodeIdSchema.parse('node-1');

describe('trialAggregateSchema', () => {
  const validAggregate: TrialAggregate = {
    trialsCount: 5,
    validTrialsCount: 5,
    invalidTrialsCount: 0,
    invalidReasons: [],
    metrics: {
      p99LatencyMs: { median: 55.4, p25: 52.1, p75: 58.9, iqr: 6.8 },
      p50LatencyMs: { median: 14.2, p25: 13.5, p75: 15.0, iqr: 1.5 },
      completionRate: { median: 0.99, p25: 0.98, p75: 1.0, iqr: 0.02 },
      retryAmplification: {
        [edge1]: { median: 1.2, p25: 1.1, p75: 1.3, iqr: 0.2 },
      },
      workerSaturation: {
        [node1]: { median: 0.3, p25: 0.25, p75: 0.35, iqr: 0.1 },
      },
      maxQueueDepth: {
        [node1]: { median: 4, p25: 3, p75: 5, iqr: 2 },
      },
      duplicateWriteRate: { median: 0, p25: 0, p75: 0, iqr: 0 },
      breakerOpenFraction: {
        [edge1]: { median: 0, p25: 0, p75: 0, iqr: 0 },
      },
    },
  };

  it('accepts valid trial aggregates', () => {
    const parsed = trialAggregateSchema.parse(validAggregate);
    expect(parsed.validTrialsCount).toBe(5);
    expect(parsed.metrics.p99LatencyMs.median).toBe(55.4);
    expect(parsed.metrics.p99LatencyMs.iqr).toBe(6.8);
  });

  it('accepts aggregates with invalid trials and recorded reasons', () => {
    const mixedAggregate: TrialAggregate = {
      ...validAggregate,
      trialsCount: 5,
      validTrialsCount: 4,
      invalidTrialsCount: 1,
      invalidReasons: ['Trial 2: worker event loop delay exceeded limit'],
    };
    const parsed = trialAggregateSchema.parse(mixedAggregate);
    expect(parsed.invalidTrialsCount).toBe(1);
    expect(parsed.invalidReasons).toHaveLength(1);
  });

  it('rejects unknown properties in strict objects', () => {
    expect(() =>
      trialAggregateSchema.parse({
        ...validAggregate,
        extraProperty: 'not_allowed',
      }),
    ).toThrow();
  });
});
