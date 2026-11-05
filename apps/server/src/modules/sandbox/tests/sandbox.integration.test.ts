import { edgeIdSchema, nodeIdSchema, topologySchema, type Topology } from '@chaosboard/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import type { SandboxHandle } from '../application/ports';
import { startSandbox } from '../index';

describe('Sandbox and Worker runtime integration', () => {
  let sandbox: SandboxHandle | null = null;

  afterEach(async () => {
    if (sandbox !== null) {
      await sandbox.stop();
      sandbox = null;
    }
  });

  const gatewayId = nodeIdSchema.parse('gateway');
  const backendId = nodeIdSchema.parse('backend');
  const edgeId = edgeIdSchema.parse('gateway-to-backend');
  const entryId = nodeIdSchema.parse('entry');
  const midId = nodeIdSchema.parse('mid');
  const sinkId = nodeIdSchema.parse('sink');
  const entryToMidId = edgeIdSchema.parse('entry-to-mid');
  const midToSinkId = edgeIdSchema.parse('mid-to-sink');
  const ledgerId = nodeIdSchema.parse('ledger');

  const twoNodeTopology: Topology = topologySchema.parse({
    schemaVersion: 1,
    id: 'two-node-test',
    name: 'Two Node Test Topology',
    source: 'scenario',
    entry: { nodeId: 'gateway' },
    nodes: [
      {
        id: 'gateway',
        label: 'Gateway Service',
        kind: 'service',
        processing: { distribution: 'constant', ms: 5 },
        concurrency: { maxWorkers: 5 },
        queue: { mode: 'bounded', maxDepth: 10 },
        ingressRateLimitRps: null,
      },
      {
        id: 'backend',
        label: 'Backend Service',
        kind: 'service',
        processing: { distribution: 'constant', ms: 10 },
        concurrency: { maxWorkers: 5 },
        queue: { mode: 'bounded', maxDepth: 10 },
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
            maxAttempts: 2,
            backoffBaseMs: 50,
            backoffMultiplier: 1.5,
            maxBackoffMs: 200,
            jitter: 'none',
          },
          breaker: {
            enabled: true,
            failureThresholdPct: 50,
            windowRequests: 5,
            cooldownMs: 1500,
            halfOpenProbes: 2,
          },
          fallback: 'fail_fast_503',
          idempotency: { sendKey: true },
          pool: { maxConnections: 10 },
        },
      },
    ],
  });

  it('spawns two real processes that communicate over real sockets', async () => {
    sandbox = await startSandbox(twoNodeTopology, undefined, {
      baseNodePort: 22100,
      baseProxyPort: 28100,
      useProxies: false, // Direct node-to-node communication in Phase 2
      readinessTimeoutMs: 10_000,
    });

    const gatewayConfig = sandbox.configs.get(gatewayId);
    expect(gatewayConfig).toBeDefined();
    if (!gatewayConfig) return;

    // Send a real request to the gateway process
    const res = await fetch(
      `http://${gatewayConfig.listenHost}:${String(gatewayConfig.listenPort)}/request`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-integ-1',
        },
        body: JSON.stringify({ message: 'hello' }),
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; nodeId: string };
    expect(body.ok).toBe(true);
    expect(body.nodeId).toBe('gateway');

    // Read real monotonic counters from workers
    const counters = await sandbox.readCounters();
    const gatewayCounters = counters.get(gatewayId);
    const backendCounters = counters.get(backendId);

    expect(gatewayCounters?.requestsIn).toBe(1);
    expect(gatewayCounters?.attemptsOut[edgeId]).toBe(1);
    expect(backendCounters?.requestsIn).toBe(1);

    // Read series
    const series = await sandbox.readSeries(gatewayId);
    const gatewaySeries = series.get(gatewayId);
    expect(gatewaySeries?.samples.length).toBeGreaterThan(0);
  });

  it('demonstrates timeout and retries under downstream delay', async () => {
    const firstNode = twoNodeTopology.nodes[0];
    const secondNode = twoNodeTopology.nodes[1];
    const firstEdge = twoNodeTopology.edges[0];
    expect(firstNode).toBeDefined();
    expect(secondNode).toBeDefined();
    expect(firstEdge).toBeDefined();
    if (!firstNode || !secondNode || !firstEdge) return;

    // Configure edge with 50ms timeout, but backend with 300ms processing time
    const timeoutTopology: Topology = {
      ...twoNodeTopology,
      id: 'timeout-topo' as Topology['id'],
      nodes: [
        firstNode,
        {
          ...secondNode,
          processing: { distribution: 'constant', ms: 300 },
        },
      ],
      edges: [
        {
          ...firstEdge,
          policy: {
            ...firstEdge.policy,
            timeoutMs: 50,
            retry: {
              maxAttempts: 3,
              backoffBaseMs: 20,
              backoffMultiplier: 1,
              maxBackoffMs: 50,
              jitter: 'none',
            },
          },
        },
      ],
    };

    sandbox = await startSandbox(timeoutTopology, undefined, {
      baseNodePort: 22200,
      baseProxyPort: 28200,
      useProxies: false,
    });

    const gatewayConfig = sandbox.configs.get(gatewayId);
    expect(gatewayConfig).toBeDefined();
    if (!gatewayConfig) return;

    const res = await fetch(
      `http://${gatewayConfig.listenHost}:${String(gatewayConfig.listenPort)}/request`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': 'req-timeout-1',
        },
      },
    );

    // Fallback is fail_fast_503 after timeouts
    expect(res.status).toBe(503);

    const counters = await sandbox.readCounters();
    const gatewayCounters = counters.get(gatewayId);

    // Max attempts was 3, so attemptsOut is 3, retries is 2, timeouts is 3
    expect(gatewayCounters?.attemptsOut[edgeId]).toBe(3);
    expect(gatewayCounters?.retries).toBe(2);
    expect(gatewayCounters?.timeouts).toBe(3);
  });

  it('demonstrates queue rejection when bounded queue is saturated', async () => {
    const firstNode = twoNodeTopology.nodes[0];
    expect(firstNode).toBeDefined();
    if (!firstNode) return;

    // Backend has concurrency 1, bounded queue 1, 300ms processing
    const queueTopology: Topology = {
      ...twoNodeTopology,
      id: 'queue-topo' as Topology['id'],
      nodes: [
        {
          ...firstNode,
          concurrency: { maxWorkers: 1 },
          queue: { mode: 'bounded', maxDepth: 1 },
          processing: { distribution: 'constant', ms: 300 },
        },
      ],
      edges: [],
    };

    sandbox = await startSandbox(queueTopology, undefined, {
      baseNodePort: 22300,
      baseProxyPort: 28300,
      useProxies: false,
    });

    const gatewayConfig = sandbox.configs.get(gatewayId);
    expect(gatewayConfig).toBeDefined();
    if (!gatewayConfig) return;

    const url = `http://${gatewayConfig.listenHost}:${String(gatewayConfig.listenPort)}/request`;

    // Fire 3 simultaneous requests (1 active, 1 queued, 1 shed)
    const promises = [
      fetch(url, { method: 'POST', headers: { 'x-request-id': 'r1' } }),
      fetch(url, { method: 'POST', headers: { 'x-request-id': 'r2' } }),
      fetch(url, { method: 'POST', headers: { 'x-request-id': 'r3' } }),
    ];

    const responses = await Promise.all(promises);
    const statuses = responses.map((r) => r.status);

    // At least one should be rejected with 503
    expect(statuses).toContain(503);

    const counters = await sandbox.readCounters(gatewayId);
    const gatewayCounters = counters.get(gatewayId);
    expect(gatewayCounters?.shedRequests).toBeGreaterThanOrEqual(1);
  });

  it('demonstrates ledger sink deduplication on idempotency key', async () => {
    const ledgerTopology: Topology = topologySchema.parse({
      schemaVersion: 1,
      id: 'ledger-topo',
      name: 'Ledger Topo',
      source: 'scenario',
      entry: { nodeId: 'ledger' },
      nodes: [
        {
          id: 'ledger',
          label: 'Ledger Sink',
          kind: 'ledger_sink',
          processing: { distribution: 'constant', ms: 5 },
          concurrency: { maxWorkers: 5 },
          queue: { mode: 'bounded', maxDepth: 10 },
          ingressRateLimitRps: null,
          dedupeByKey: true,
        },
      ],
      edges: [],
    });

    sandbox = await startSandbox(ledgerTopology, undefined, {
      baseNodePort: 22400,
      baseProxyPort: 28400,
      useProxies: false,
    });

    const ledgerConfig = sandbox.configs.get(ledgerId);
    expect(ledgerConfig).toBeDefined();
    if (!ledgerConfig) return;

    const url = `http://${ledgerConfig.listenHost}:${String(ledgerConfig.listenPort)}/request`;

    // 1st request with idempotency key
    const res1 = await fetch(url, {
      method: 'POST',
      headers: {
        'x-request-id': 'tx-1',
        'x-idempotency-key': 'idem-key-abc',
      },
    });
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as { committed: boolean; duplicate: boolean };
    expect(body1.committed).toBe(true);
    expect(body1.duplicate).toBe(false);

    // 2nd request with the SAME idempotency key
    const res2 = await fetch(url, {
      method: 'POST',
      headers: {
        'x-request-id': 'tx-2',
        'x-idempotency-key': 'idem-key-abc',
      },
    });
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { committed: boolean; duplicate: boolean };
    expect(body2.committed).toBe(false);
    expect(body2.duplicate).toBe(true);

    const counters = await sandbox.readCounters(ledgerId);
    expect(counters.get(ledgerId)?.ledgerDuplicates).toBe(1);
  });

  it('runs a three-node topology across multiple hops', async () => {
    const threeNodeTopology: Topology = topologySchema.parse({
      schemaVersion: 1,
      id: 'three-node-test',
      name: 'Three Node Test Topology',
      source: 'scenario',
      entry: { nodeId: 'entry' },
      nodes: [
        {
          id: 'entry',
          label: 'Entry Service',
          kind: 'service',
          processing: { distribution: 'constant', ms: 5 },
          concurrency: { maxWorkers: 5 },
          queue: { mode: 'bounded', maxDepth: 10 },
          ingressRateLimitRps: null,
        },
        {
          id: 'mid',
          label: 'Middle Service',
          kind: 'service',
          processing: { distribution: 'constant', ms: 5 },
          concurrency: { maxWorkers: 5 },
          queue: { mode: 'bounded', maxDepth: 10 },
          ingressRateLimitRps: null,
        },
        {
          id: 'sink',
          label: 'Sink Service',
          kind: 'service',
          processing: { distribution: 'constant', ms: 5 },
          concurrency: { maxWorkers: 5 },
          queue: { mode: 'bounded', maxDepth: 10 },
          ingressRateLimitRps: null,
        },
      ],
      edges: [
        {
          id: 'entry-to-mid',
          source: 'entry',
          target: 'mid',
          mode: 'sync_call',
          policy: {
            timeoutMs: 2000,
            retry: {
              maxAttempts: 2,
              backoffBaseMs: 50,
              backoffMultiplier: 1,
              maxBackoffMs: 100,
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
          id: 'mid-to-sink',
          source: 'mid',
          target: 'sink',
          mode: 'sync_call',
          policy: {
            timeoutMs: 2000,
            retry: {
              maxAttempts: 2,
              backoffBaseMs: 50,
              backoffMultiplier: 1,
              maxBackoffMs: 100,
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

    sandbox = await startSandbox(threeNodeTopology, undefined, {
      baseNodePort: 22500,
      baseProxyPort: 28500,
      useProxies: false,
    });

    const entryConfig = sandbox.configs.get(entryId);
    expect(entryConfig).toBeDefined();
    if (!entryConfig) return;

    const res = await fetch(
      `http://${entryConfig.listenHost}:${String(entryConfig.listenPort)}/request`,
      {
        method: 'POST',
        headers: { 'x-request-id': 'three-hop-1' },
      },
    );

    expect(res.status).toBe(200);

    const counters = await sandbox.readCounters();
    expect(counters.get(entryId)?.requestsIn).toBe(1);
    expect(counters.get(entryId)?.attemptsOut[entryToMidId]).toBe(1);
    expect(counters.get(midId)?.requestsIn).toBe(1);
    expect(counters.get(midId)?.attemptsOut[midToSinkId]).toBe(1);
    expect(counters.get(sinkId)?.requestsIn).toBe(1);

    // Reset counters and verify they return to 0
    await sandbox.resetCounters();
    const afterReset = await sandbox.readCounters();
    expect(afterReset.get(entryId)?.requestsIn).toBe(0);
    expect(afterReset.get(midId)?.requestsIn).toBe(0);
    expect(afterReset.get(sinkId)?.requestsIn).toBe(0);
  });
});
