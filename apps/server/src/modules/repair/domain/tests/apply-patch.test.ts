import { describe, it, expect } from 'vitest';
import {
  edgeIdSchema,
  nodeIdSchema,
  topologySchema,
  type RepairPatch,
  type Topology,
} from '@chaosboard/contracts';
import { applyRepairPatch } from '../apply-patch';

describe('applyRepairPatch', () => {
  const baseTopology: Topology = topologySchema.parse({
    schemaVersion: 1,
    id: 't-test',
    name: 'Test Topo',
    source: 'scenario',
    entry: { nodeId: 'svc-a' },
    nodes: [
      {
        id: 'svc-a',
        label: 'A',
        kind: 'service',
        processing: { distribution: 'constant', ms: 5 },
        concurrency: { maxWorkers: 10 },
        queue: { mode: 'bounded', maxDepth: 50 },
        ingressRateLimitRps: null,
      },
    ],
    edges: [
      {
        id: 'a-to-b',
        source: 'svc-a',
        target: 'svc-b',
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

  it('purely applies patch without mutating original topology', () => {
    const patch: RepairPatch = {
      schemaVersion: 1,
      hypothesis: 'Improve resilience',
      operations: [
        {
          op: 'set_retry',
          edgeId: edgeIdSchema.parse('a-to-b'),
          maxAttempts: 2,
          backoffBaseMs: 100,
          backoffMultiplier: 2,
          maxBackoffMs: 1000,
          jitter: 'full',
          rationale: 'Backoff',
        },
        {
          op: 'set_concurrency',
          nodeId: nodeIdSchema.parse('svc-a'),
          maxWorkers: 25,
          rationale: 'Concurrency',
        },
      ],
    };

    const newTopo = applyRepairPatch(baseTopology, patch);

    // Verify original unmodified
    expect(baseTopology.edges[0]?.policy.retry.backoffBaseMs).toBe(0);
    expect(baseTopology.nodes[0]?.concurrency.maxWorkers).toBe(10);

    // Verify new topology modified
    expect(newTopo.edges[0]?.policy.retry.backoffBaseMs).toBe(100);
    expect(newTopo.edges[0]?.policy.retry.maxAttempts).toBe(2);
    expect(newTopo.nodes[0]?.concurrency.maxWorkers).toBe(25);
  });
});
