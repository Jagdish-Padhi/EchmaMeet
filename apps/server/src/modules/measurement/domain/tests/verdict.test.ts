import { describe, it, expect } from 'vitest';
import { evaluateInvariantVerdict, computeOverallStatus } from '../verdict';
import {
  edgeIdSchema,
  invariantIdSchema,
  type Invariant,
  type TrialAggregate,
} from '@chaosboard/contracts';

describe('measurement domain verdict evaluation', () => {
  const edge1 = edgeIdSchema.parse('edge-1');
  const inv1 = invariantIdSchema.parse('inv-p99');

  const makeAggregate = (p99: {
    median: number;
    p25: number;
    p75: number;
    iqr: number;
  }): TrialAggregate => ({
    trialsCount: 3,
    validTrialsCount: 3,
    invalidTrialsCount: 0,
    invalidReasons: [],
    metrics: {
      p99LatencyMs: p99,
      p50LatencyMs: {
        median: p99.median / 2,
        p25: p99.p25 / 2,
        p75: p99.p75 / 2,
        iqr: p99.iqr / 2,
      },
      completionRate: { median: 1, p25: 1, p75: 1, iqr: 0 },
      retryAmplification: { [edge1]: { median: 1, p25: 1, p75: 1, iqr: 0 } },
      workerSaturation: {},
      maxQueueDepth: {},
      duplicateWriteRate: { median: null, p25: null, p75: null, iqr: null },
      breakerOpenFraction: { [edge1]: { median: 0, p25: 0, p75: 0, iqr: 0 } },
    },
  });

  const invariant: Invariant = {
    id: inv1,
    metric: 'e2e_p99_ms',
    scope: { kind: 'system' },
    comparator: 'lte',
    threshold: 200,
  };

  it('produces PASS when median and p75 are <= threshold', () => {
    const baseline = makeAggregate({ median: 50, p25: 45, p75: 55, iqr: 10 });
    const faulted = makeAggregate({ median: 150, p25: 140, p75: 160, iqr: 20 });

    const verdict = evaluateInvariantVerdict({
      invariant,
      baselineAggregate: baseline,
      faultedAggregate: faulted,
    });

    expect(verdict.status).toBe('PASS');
    expect(verdict.reason).toBeNull();
  });

  it('produces VIOLATED when median and p25 are > threshold', () => {
    const baseline = makeAggregate({ median: 50, p25: 45, p75: 55, iqr: 10 });
    const faulted = makeAggregate({ median: 300, p25: 250, p75: 350, iqr: 100 });

    const verdict = evaluateInvariantVerdict({
      invariant,
      baselineAggregate: baseline,
      faultedAggregate: faulted,
    });

    expect(verdict.status).toBe('VIOLATED');
  });

  it('produces INCONCLUSIVE when IQR straddles threshold', () => {
    const baseline = makeAggregate({ median: 50, p25: 45, p75: 55, iqr: 10 });
    // median 190 <= 200, but p75 = 220 > 200 (straddles!)
    const faulted = makeAggregate({ median: 190, p25: 170, p75: 220, iqr: 50 });

    const verdict = evaluateInvariantVerdict({
      invariant,
      baselineAggregate: baseline,
      faultedAggregate: faulted,
    });

    expect(verdict.status).toBe('INCONCLUSIVE');
    expect(verdict.reason).toContain('straddles threshold 200');
  });

  it('produces INVALID when baseline already violates threshold', () => {
    // baseline is 250 > 200!
    const baseline = makeAggregate({ median: 250, p25: 240, p75: 260, iqr: 20 });
    const faulted = makeAggregate({ median: 300, p25: 280, p75: 320, iqr: 40 });

    const verdict = evaluateInvariantVerdict({
      invariant,
      baselineAggregate: baseline,
      faultedAggregate: faulted,
    });

    expect(verdict.status).toBe('INVALID');
    expect(verdict.reason).toContain('Baseline already violates invariant');
  });

  it('produces INVALID when baseline has zero valid trials', () => {
    const baseline: TrialAggregate = {
      ...makeAggregate({ median: 50, p25: 45, p75: 55, iqr: 10 }),
      validTrialsCount: 0,
    };
    const faulted = makeAggregate({ median: 150, p25: 140, p75: 160, iqr: 20 });

    const verdict = evaluateInvariantVerdict({
      invariant,
      baselineAggregate: baseline,
      faultedAggregate: faulted,
    });

    expect(verdict.status).toBe('INVALID');
    expect(verdict.reason).toContain('Zero valid trials');
  });

  it('computes overall status across multiple verdicts correctly', () => {
    expect(computeOverallStatus([])).toBe('PASS');

    const passVerdict = evaluateInvariantVerdict({
      invariant,
      baselineAggregate: makeAggregate({ median: 50, p25: 45, p75: 55, iqr: 10 }),
      faultedAggregate: makeAggregate({ median: 150, p25: 140, p75: 160, iqr: 20 }),
    });

    const violatedVerdict = evaluateInvariantVerdict({
      invariant,
      baselineAggregate: makeAggregate({ median: 50, p25: 45, p75: 55, iqr: 10 }),
      faultedAggregate: makeAggregate({ median: 300, p25: 250, p75: 350, iqr: 100 }),
    });

    expect(computeOverallStatus([passVerdict])).toBe('PASS');
    expect(computeOverallStatus([passVerdict, violatedVerdict])).toBe('VIOLATED');
  });
});
