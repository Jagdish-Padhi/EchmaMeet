import { describe, it, expect } from 'vitest';
import { invariantVerdictSchema, experimentVerdictsSchema } from './verdict';
import { invariantIdSchema } from './ids';

describe('verdict contracts', () => {
  const inv1 = invariantIdSchema.parse('inv-latency');

  it('accepts valid invariant verdict and experiment verdicts', () => {
    const verdict = invariantVerdictSchema.parse({
      invariantId: inv1,
      status: 'PASS',
      reason: null,
      evidence: {
        metric: 'e2e_p99_ms',
        scope: { kind: 'system' },
        comparator: 'lte',
        threshold: 200,
        baselineAggregate: { median: 50, p25: 45, p75: 55, iqr: 10 },
        faultedAggregate: { median: 120, p25: 110, p75: 130, iqr: 20 },
        baselineValues: [45, 50, 55],
        faultedValues: [110, 120, 130],
      },
    });
    expect(verdict.status).toBe('PASS');

    const exp = experimentVerdictsSchema.parse({
      overallStatus: 'PASS',
      verdicts: [verdict],
    });
    expect(exp.overallStatus).toBe('PASS');
  });

  it('accepts INVALID verdict with reason', () => {
    const verdict = invariantVerdictSchema.parse({
      invariantId: inv1,
      status: 'INVALID',
      reason: 'Baseline already violates invariant',
      evidence: {
        metric: 'e2e_p99_ms',
        scope: { kind: 'system' },
        comparator: 'lte',
        threshold: 200,
        baselineAggregate: { median: 250, p25: 240, p75: 260, iqr: 20 },
        faultedAggregate: null,
        baselineValues: [240, 250, 260],
        faultedValues: [],
      },
    });
    expect(verdict.status).toBe('INVALID');
    expect(verdict.reason).toContain('Baseline already violates');
  });

  it('rejects unknown verdict status', () => {
    expect(() =>
      invariantVerdictSchema.parse({
        invariantId: inv1,
        status: 'UNKNOWN_STATUS',
        reason: null,
        evidence: {
          metric: 'e2e_p99_ms',
          scope: { kind: 'system' },
          comparator: 'lte',
          threshold: 200,
          baselineAggregate: null,
          faultedAggregate: null,
          baselineValues: [],
          faultedValues: [],
        },
      }),
    ).toThrow();
  });
});
