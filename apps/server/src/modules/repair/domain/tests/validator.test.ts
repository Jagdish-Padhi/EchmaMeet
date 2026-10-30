import { describe, it, expect } from 'vitest';
import {
  edgeIdSchema,
  topologySchema,
  type RepairPatch,
  type Topology,
} from '@chaosboard/contracts';
import { validateRepairPatch } from '../validator';

describe('validateRepairPatch', () => {
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
      {
        id: 'svc-b',
        label: 'B',
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

  it('validates a valid patch', () => {
    const patch: RepairPatch = {
      schemaVersion: 1,
      hypothesis: 'Add backoff',
      operations: [
        {
          op: 'set_retry',
          edgeId: edgeIdSchema.parse('a-to-b'),
          maxAttempts: 2,
          backoffBaseMs: 100,
          backoffMultiplier: 2,
          maxBackoffMs: 1000,
          jitter: 'full',
          rationale: 'Reduce retries',
        },
      ],
    };

    const res = validateRepairPatch(baseTopology, patch);
    expect(res.valid).toBe(true);
    expect(res.problems.length).toBe(0);
  });

  it('rejects unknown edge id', () => {
    const patch: RepairPatch = {
      schemaVersion: 1,
      hypothesis: 'Invalid edge',
      operations: [
        {
          op: 'set_timeout',
          edgeId: edgeIdSchema.parse('nonexistent-edge'),
          timeoutMs: 500,
          rationale: 'Bad edge',
        },
      ],
    };

    const res = validateRepairPatch(baseTopology, patch);
    expect(res.valid).toBe(false);
    expect(res.problems.some((p) => p.code === 'unknown_edge')).toBe(true);
  });

  it('rejects stale-cache fallback without cache source node', () => {
    const patch: RepairPatch = {
      schemaVersion: 1,
      hypothesis: 'Stale cache fallback',
      operations: [
        {
          op: 'set_fallback',
          edgeId: edgeIdSchema.parse('a-to-b'),
          fallback: 'serve_stale_cache',
          rationale: 'Cache fallback',
        },
      ],
    };

    const res = validateRepairPatch(baseTopology, patch);
    expect(res.valid).toBe(false);
    expect(res.problems.some((p) => p.code === 'stale_cache_without_cache')).toBe(true);
  });

  it('rejects async mode when target is not a queue consumer', () => {
    const patch: RepairPatch = {
      schemaVersion: 1,
      hypothesis: 'Async mode on normal service',
      operations: [
        {
          op: 'set_edge_mode',
          edgeId: edgeIdSchema.parse('a-to-b'),
          mode: 'async_enqueue',
          rationale: 'Make async',
        },
      ],
    };

    const res = validateRepairPatch(baseTopology, patch);
    expect(res.valid).toBe(false);
    expect(res.problems.some((p) => p.code === 'async_requires_queue_consumer')).toBe(true);
  });
});
