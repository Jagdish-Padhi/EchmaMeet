import { describe, it, expect } from 'vitest';
import { edgeIdSchema, invariantIdSchema, type InvariantVerdict } from '@chaosboard/contracts';
import { evaluateRepairDecision } from '../decision';

describe('evaluateRepairDecision', () => {
  const invA: InvariantVerdict = {
    invariantId: invariantIdSchema.parse('inv-a'),
    status: 'VIOLATED',
    reason: null,
    evidence: {
      metric: 'retry_amplification',
      scope: { kind: 'edge', edgeId: edgeIdSchema.parse('e-1') },
      comparator: 'lte',
      threshold: 1.5,
      baselineAggregate: { median: 1.0, p25: 1.0, p75: 1.0, iqr: 0 },
      faultedAggregate: { median: 3.0, p25: 3.0, p75: 3.0, iqr: 0 },
      baselineValues: [1.0],
      faultedValues: [3.0],
    },
  };

  const invB: InvariantVerdict = {
    invariantId: invariantIdSchema.parse('inv-b'),
    status: 'PASS',
    reason: null,
    evidence: {
      metric: 'completion_rate',
      scope: { kind: 'system' },
      comparator: 'gte',
      threshold: 0.95,
      baselineAggregate: { median: 1.0, p25: 1.0, p75: 1.0, iqr: 0 },
      faultedAggregate: { median: 1.0, p25: 1.0, p75: 1.0, iqr: 0 },
      baselineValues: [1.0],
      faultedValues: [1.0],
    },
  };

  it('accepts initial run', () => {
    const res = evaluateRepairDecision([], [invA, invB]);
    expect(res.decision).toBe('accept');
  });

  it('accepts when violated invariant improves to PASS with no regression', () => {
    const currentA: InvariantVerdict = { ...invA, status: 'PASS' };
    const res = evaluateRepairDecision([invA, invB], [currentA, invB]);
    expect(res.decision).toBe('accept');
    expect(res.reason).toContain('transitioned to PASS');
  });

  it('rolls back when a previously passing invariant regresses to VIOLATED', () => {
    const currentA: InvariantVerdict = { ...invA, status: 'PASS' };
    const currentB: InvariantVerdict = { ...invB, status: 'VIOLATED' }; // Regressed!

    const res = evaluateRepairDecision([invA, invB], [currentA, currentB]);
    expect(res.decision).toBe('rollback');
    expect(res.reason).toContain('Regression detected');
  });

  it('rolls back when no invariant improves', () => {
    const res = evaluateRepairDecision([invA, invB], [invA, invB]);
    expect(res.decision).toBe('rollback');
  });
});
