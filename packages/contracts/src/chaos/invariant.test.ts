import { describe, expect, it } from 'vitest';
import { invariantSchema } from './invariant';

describe('invariantSchema', () => {
  it('accepts a system-scoped latency invariant', () => {
    const result = invariantSchema.safeParse({
      id: 'p99-under-500',
      metric: 'e2e_p99_ms',
      scope: { kind: 'system' },
      comparator: 'lte',
      threshold: 500,
    });
    expect(result.success).toBe(true);
  });

  it('accepts an edge-scoped retry amplification invariant', () => {
    const result = invariantSchema.safeParse({
      id: 'amplification-bounded',
      metric: 'retry_amplification',
      scope: { kind: 'edge', edgeId: 'checkout-to-inventory' },
      comparator: 'lte',
      threshold: 1.5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a scope kind that does not match the metric', () => {
    const result = invariantSchema.safeParse({
      id: 'bad-scope',
      metric: 'retry_amplification',
      scope: { kind: 'system' },
      comparator: 'lte',
      threshold: 2,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative and non-finite thresholds', () => {
    for (const threshold of [-1, Number.POSITIVE_INFINITY, Number.NaN]) {
      const result = invariantSchema.safeParse({
        id: 'bad-threshold',
        metric: 'e2e_error_rate',
        scope: { kind: 'system' },
        comparator: 'lte',
        threshold,
      });
      expect(result.success).toBe(false);
    }
  });
});
