import { describe, it, expect } from 'vitest';
import {
  edgeIdSchema,
  invariantIdSchema,
  topologySchema,
  type InvariantVerdict,
  type Topology,
} from '@chaosboard/contracts';
import { proposeBaselineRepair } from '../baseline-repairer';

describe('proposeBaselineRepair', () => {
  const baseTopology: Topology = topologySchema.parse({
    schemaVersion: 1,
    id: 't-test',
    name: 'Test Topo',
    source: 'scenario',
    entry: { nodeId: 'gateway' },
    nodes: [
      {
        id: 'gateway',
        label: 'Gateway',
        kind: 'service',
        processing: { distribution: 'constant', ms: 5 },
        concurrency: { maxWorkers: 10 },
        queue: { mode: 'bounded', maxDepth: 50 },
        ingressRateLimitRps: null,
      },
      {
        id: 'backend',
        label: 'Backend',
        kind: 'service',
        processing: { distribution: 'constant', ms: 5 },
        concurrency: { maxWorkers: 10 },
        queue: { mode: 'bounded', maxDepth: 50 },
        ingressRateLimitRps: null,
      },
    ],
    edges: [
      {
        id: 'gateway-to-backend',
        source: 'gateway',
        target: 'backend',
        mode: 'sync_call',
        policy: {
          timeoutMs: 2000,
          retry: {
            maxAttempts: 3,
            backoffBaseMs: 0,
            backoffMultiplier: 1,
            maxBackoffMs: 0,
            jitter: 'none',
          },
          breaker: {
            enabled: false,
            failureThresholdPct: 50,
            windowRequests: 20,
            cooldownMs: 5000,
            halfOpenProbes: 1,
          },
          fallback: 'fail_fast_503',
          idempotency: { sendKey: false },
          pool: { maxConnections: 50 },
        },
      },
    ],
  });

  it('proposes backoff patch when retry amplification is violated', () => {
    const retryViolation: InvariantVerdict = {
      invariantId: invariantIdSchema.parse('inv-retry'),
      status: 'VIOLATED',
      reason: null,
      evidence: {
        metric: 'retry_amplification',
        scope: { kind: 'edge', edgeId: edgeIdSchema.parse('gateway-to-backend') },
        comparator: 'lte',
        threshold: 1.5,
        baselineAggregate: { median: 1.0, p25: 1.0, p75: 1.0, iqr: 0 },
        faultedAggregate: { median: 3.0, p25: 3.0, p75: 3.0, iqr: 0 },
        baselineValues: [1.0],
        faultedValues: [3.0],
      },
    };

    const patch = proposeBaselineRepair(baseTopology, [retryViolation], 0);
    expect(patch).not.toBeNull();
    expect(patch?.operations.length).toBe(1);
    expect(patch?.operations[0]?.op).toBe('set_retry');
    if (patch?.operations[0]?.op === 'set_retry') {
      expect(patch.operations[0].backoffBaseMs).toBe(100);
      expect(patch.operations[0].jitter).toBe('full');
    }
  });

  it('returns null when all invariants pass', () => {
    const passing: InvariantVerdict = {
      invariantId: invariantIdSchema.parse('inv-pass'),
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

    const patch = proposeBaselineRepair(baseTopology, [passing], 0);
    expect(patch).toBeNull();
  });
});
