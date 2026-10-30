import { describe, it, expect } from 'vitest';
import {
  repairOperationSchema,
  repairPatchSchema,
  patchValidationProblemSchema,
} from './repair-patch';

describe('Repair patch contract schemas', () => {
  it('parses valid operations and patches', () => {
    const validPatch = {
      schemaVersion: 1,
      hypothesis: 'Introduce exponential backoff and circuit breaker to stop retry amplification',
      operations: [
        {
          op: 'set_retry',
          edgeId: 'e-1',
          maxAttempts: 2,
          backoffBaseMs: 100,
          backoffMultiplier: 2,
          maxBackoffMs: 1000,
          jitter: 'full',
          rationale: 'Reduce retry pressure',
        },
        {
          op: 'set_circuit_breaker',
          edgeId: 'e-1',
          enabled: true,
          failureThresholdPct: 50,
          windowRequests: 10,
          cooldownMs: 5000,
          halfOpenProbes: 3,
          rationale: 'Fast fail once service fails',
        },
      ],
    };

    const parsed = repairPatchSchema.parse(validPatch);
    expect(parsed.operations.length).toBe(2);
    expect(parsed.operations[0]?.op).toBe('set_retry');
  });

  it('rejects out of bounds operation parameters', () => {
    const invalidOp = {
      op: 'set_retry',
      edgeId: 'e-1',
      maxAttempts: 10, // Max is 6
      backoffBaseMs: 100,
      backoffMultiplier: 2,
      maxBackoffMs: 1000,
      jitter: 'full',
      rationale: 'Too many attempts',
    };

    const result = repairOperationSchema.safeParse(invalidOp);
    expect(result.success).toBe(false);
  });

  it('parses patch validation problems', () => {
    const problem = {
      code: 'out_of_bounds',
      targetId: 'e-1',
      message: 'Max attempts 10 exceeds upper bound 6',
    };

    const parsed = patchValidationProblemSchema.parse(problem);
    expect(parsed.code).toBe('out_of_bounds');
  });
});
