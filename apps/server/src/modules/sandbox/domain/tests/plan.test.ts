import { topologySchema, type Topology } from '@chaosboard/contracts';
import { describe, expect, it } from 'vitest';
import { allocateNetworkPlan } from '../plan';

describe('allocateNetworkPlan', () => {
  const sampleTopology: Topology = topologySchema.parse({
    schemaVersion: 1,
    id: 'test-topology',
    name: 'Test Topology',
    source: 'scenario',
    entry: { nodeId: 'gateway' },
    nodes: [
      {
        id: 'gateway',
        label: 'Gateway',
        kind: 'service',
        processing: { distribution: 'constant', ms: 10 },
        concurrency: { maxWorkers: 10 },
        queue: { mode: 'bounded', maxDepth: 50 },
        ingressRateLimitRps: null,
      },
      {
        id: 'service-a',
        label: 'Service A',
        kind: 'service',
        processing: { distribution: 'constant', ms: 20 },
        concurrency: { maxWorkers: 5 },
        queue: { mode: 'bounded', maxDepth: 20 },
        ingressRateLimitRps: null,
      },
      {
        id: 'service-b',
        label: 'Service B',
        kind: 'service',
        processing: { distribution: 'constant', ms: 15 },
        concurrency: { maxWorkers: 5 },
        queue: { mode: 'bounded', maxDepth: 20 },
        ingressRateLimitRps: null,
      },
    ],
    edges: [
      {
        id: 'gateway-to-a',
        source: 'gateway',
        target: 'service-a',
        mode: 'sync_call',
        policy: {
          timeoutMs: 1000,
          retry: {
            maxAttempts: 2,
            backoffBaseMs: 50,
            backoffMultiplier: 2,
            maxBackoffMs: 500,
            jitter: 'none',
          },
          breaker: {
            enabled: false,
            failureThresholdPct: 50,
            windowRequests: 10,
            cooldownMs: 2000,
            halfOpenProbes: 2,
          },
          fallback: 'fail_fast_503',
          idempotency: { sendKey: false },
          pool: { maxConnections: 10 },
        },
      },
      {
        id: 'gateway-to-b',
        source: 'gateway',
        target: 'service-b',
        mode: 'sync_call',
        policy: {
          timeoutMs: 1000,
          retry: {
            maxAttempts: 2,
            backoffBaseMs: 50,
            backoffMultiplier: 2,
            maxBackoffMs: 500,
            jitter: 'none',
          },
          breaker: {
            enabled: false,
            failureThresholdPct: 50,
            windowRequests: 10,
            cooldownMs: 2000,
            halfOpenProbes: 2,
          },
          fallback: 'fail_fast_503',
          idempotency: { sendKey: false },
          pool: { maxConnections: 10 },
        },
      },
    ],
  });

  it('allocates distinct, non-overlapping ports without collisions', () => {
    const plan = allocateNetworkPlan(sampleTopology, {
      baseNodePort: 21000,
      baseProxyPort: 28000,
    });

    expect(plan.topologyId).toBe('test-topology');
    expect(plan.nodes).toHaveLength(3);
    expect(plan.edges).toHaveLength(2);

    const allPorts = [...plan.nodes.map((n) => n.port), ...plan.edges.map((e) => e.proxyPort)];
    const uniquePorts = new Set(allPorts);
    expect(uniquePorts.size).toBe(allPorts.length);

    expect(plan.nodes[0]?.port).toBe(21000);
    expect(plan.nodes[1]?.port).toBe(21001);
    expect(plan.nodes[2]?.port).toBe(21002);

    expect(plan.edges[0]?.proxyPort).toBe(28000);
    expect(plan.edges[1]?.proxyPort).toBe(28001);
  });

  it('respects reserved ports and skips them', () => {
    const plan = allocateNetworkPlan(sampleTopology, {
      baseNodePort: 21000,
      baseProxyPort: 28000,
      reservedPorts: new Set([21001, 28000]),
    });

    expect(plan.nodes[0]?.port).toBe(21000);
    expect(plan.nodes[1]?.port).toBe(21002); // 21001 was skipped
    expect(plan.nodes[2]?.port).toBe(21003);

    expect(plan.edges[0]?.proxyPort).toBe(28001); // 28000 was skipped
    expect(plan.edges[1]?.proxyPort).toBe(28002);
  });
});
