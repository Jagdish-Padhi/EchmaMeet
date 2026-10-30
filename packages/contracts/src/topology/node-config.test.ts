import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { nodeConfigSchema } from './node-config';

type NodeConfigInput = z.input<typeof nodeConfigSchema>;

describe('nodeConfigSchema', () => {
  const validServiceConfig: NodeConfigInput = {
    schemaVersion: 1,
    nodeId: 'gateway',
    topologyId: 'topo-1',
    listenHost: '127.0.0.1',
    listenPort: 20001,
    node: {
      id: 'gateway',
      label: 'API Gateway',
      kind: 'service',
      processing: { distribution: 'constant', ms: 10 },
      concurrency: { maxWorkers: 50 },
      queue: { mode: 'bounded', maxDepth: 100 },
      ingressRateLimitRps: 500,
    },
    outgoingEdges: [
      {
        edgeId: 'e-1',
        targetNodeId: 'backend',
        targetUrl: 'http://127.0.0.1:28001',
        mode: 'sync_call',
        policy: {
          timeoutMs: 2000,
          retry: {
            maxAttempts: 3,
            backoffBaseMs: 50,
            backoffMultiplier: 2,
            maxBackoffMs: 1000,
            jitter: 'full',
          },
          breaker: {
            enabled: true,
            failureThresholdPct: 50,
            windowRequests: 20,
            cooldownMs: 5000,
            halfOpenProbes: 3,
          },
          fallback: 'fail_fast_503',
          idempotency: { sendKey: true },
          pool: { maxConnections: 50 },
        },
      },
    ],
    seed: 42,
    sampleIntervalMs: 50,
  };

  it('accepts a valid service node configuration', () => {
    const parsed = nodeConfigSchema.parse(validServiceConfig);
    expect(parsed.nodeId).toBe('gateway');
    expect(parsed.listenPort).toBe(20001);
    expect(parsed.outgoingEdges).toHaveLength(1);
  });

  it('accepts cache, queue_consumer, and ledger_sink configurations', () => {
    const cacheConfig = {
      ...validServiceConfig,
      nodeId: 'cache-node',
      node: {
        id: 'cache-node',
        label: 'Cache Node',
        kind: 'cache',
        processing: { distribution: 'constant', ms: 5 },
        concurrency: { maxWorkers: 20 },
        queue: { mode: 'bounded', maxDepth: 50 },
        ingressRateLimitRps: null,
        ttlMs: 5000,
      },
    };
    expect(nodeConfigSchema.parse(cacheConfig).node.kind).toBe('cache');

    const consumerConfig = {
      ...validServiceConfig,
      nodeId: 'consumer-node',
      node: {
        id: 'consumer-node',
        label: 'Consumer Node',
        kind: 'queue_consumer',
        processing: { distribution: 'constant', ms: 20 },
        concurrency: { maxWorkers: 10 },
        queue: { mode: 'unbounded' },
        ingressRateLimitRps: null,
        consumeRateRps: 200,
      },
    };
    expect(nodeConfigSchema.parse(consumerConfig).node.kind).toBe('queue_consumer');

    const ledgerConfig = {
      ...validServiceConfig,
      nodeId: 'ledger-node',
      node: {
        id: 'ledger-node',
        label: 'Ledger Sink',
        kind: 'ledger_sink',
        processing: { distribution: 'constant', ms: 15 },
        concurrency: { maxWorkers: 10 },
        queue: { mode: 'bounded', maxDepth: 20 },
        ingressRateLimitRps: null,
        dedupeByKey: true,
      },
      outgoingEdges: [],
    };
    expect(nodeConfigSchema.parse(ledgerConfig).node.kind).toBe('ledger_sink');
  });

  it('rejects invalid ports and invalid URLs', () => {
    expect(() =>
      nodeConfigSchema.parse({
        ...validServiceConfig,
        listenPort: 80, // below 1024
      }),
    ).toThrow();

    const firstEdge = validServiceConfig.outgoingEdges[0];
    expect(firstEdge).toBeDefined();
    if (firstEdge !== undefined) {
      expect(() =>
        nodeConfigSchema.parse({
          ...validServiceConfig,
          outgoingEdges: [
            {
              ...firstEdge,
              targetUrl: 'not-a-url',
            },
          ],
        }),
      ).toThrow();
    }
  });

  it('rejects extra keys (strict)', () => {
    expect(() =>
      nodeConfigSchema.parse({
        ...validServiceConfig,
        unexpectedProperty: 123,
      }),
    ).toThrow();
  });
});
