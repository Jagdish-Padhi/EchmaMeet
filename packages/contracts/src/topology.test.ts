import { describe, expect, it } from 'vitest';
import { catalog } from './catalog';
import { topologySchema } from './topology';

type Mutable = Record<string, unknown>;

function buildValidTopologyInput(): unknown {
  return {
    schemaVersion: 1,
    id: 'fixture-topology',
    name: 'Fixture topology',
    source: 'scenario',
    entry: { nodeId: 'gateway' },
    nodes: [
      {
        id: 'gateway',
        label: 'Gateway',
        kind: 'service',
        processing: { distribution: 'constant', ms: 10 },
        concurrency: { maxWorkers: 20 },
        queue: { mode: 'bounded', maxDepth: 100 },
        ingressRateLimitRps: null,
      },
      {
        id: 'inventory',
        label: 'Inventory',
        kind: 'service',
        processing: { distribution: 'lognormal', medianMs: 20, sigma: 0.4 },
        concurrency: { maxWorkers: 10 },
        queue: { mode: 'unbounded' },
        ingressRateLimitRps: 500,
      },
    ],
    edges: [
      {
        id: 'gateway-to-inventory',
        source: 'gateway',
        target: 'inventory',
        mode: 'sync_call',
        policy: {
          timeoutMs: 1000,
          retry: {
            maxAttempts: 2,
            backoffBaseMs: 50,
            backoffMultiplier: 2,
            maxBackoffMs: 500,
            jitter: 'full',
          },
          breaker: {
            enabled: false,
            failureThresholdPct: 50,
            windowRequests: 20,
            cooldownMs: 2000,
            halfOpenProbes: 2,
          },
          fallback: 'fail_fast_503',
          idempotency: { sendKey: false },
          pool: { maxConnections: 50 },
        },
      },
    ],
  };
}

function cloneInput(): Mutable {
  return structuredClone(buildValidTopologyInput()) as Mutable;
}

function nodes(input: Mutable): Mutable[] {
  return input['nodes'] as Mutable[];
}

function edges(input: Mutable): Mutable[] {
  return input['edges'] as Mutable[];
}

describe('topologySchema', () => {
  it('accepts a valid topology', () => {
    expect(topologySchema.safeParse(buildValidTopologyInput()).success).toBe(true);
  });

  it('rejects unknown keys at every level', () => {
    const top = cloneInput();
    top['surprise'] = true;
    expect(topologySchema.safeParse(top).success).toBe(false);

    const nested = cloneInput();
    (nodes(nested)[0] as Mutable)['surprise'] = 1;
    expect(topologySchema.safeParse(nested).success).toBe(false);
  });

  it('rejects ids that are not lowercase slugs', () => {
    const input = cloneInput();
    (nodes(input)[0] as Mutable)['id'] = 'Gateway One';
    expect(topologySchema.safeParse(input).success).toBe(false);
  });

  it('rejects an unknown node kind', () => {
    const input = cloneInput();
    (nodes(input)[0] as Mutable)['kind'] = 'database';
    expect(topologySchema.safeParse(input).success).toBe(false);
  });

  it('requires kind-specific fields', () => {
    const input = cloneInput();
    (nodes(input)[1] as Mutable)['kind'] = 'cache';
    expect(topologySchema.safeParse(input).success).toBe(false);
    (nodes(input)[1] as Mutable)['ttlMs'] = 1000;
    expect(topologySchema.safeParse(input).success).toBe(true);
  });

  it('treats a null timeout as valid and a zero timeout as invalid', () => {
    const withNull = cloneInput();
    const edgePolicy = (edges(withNull)[0] as Mutable)['policy'] as Mutable;
    edgePolicy['timeoutMs'] = null;
    expect(topologySchema.safeParse(withNull).success).toBe(true);
    edgePolicy['timeoutMs'] = 0;
    expect(topologySchema.safeParse(withNull).success).toBe(false);
  });

  it('enforces the lower and upper catalog bound of retry attempts', () => {
    for (const [value, expected] of [
      [catalog.edge.maxAttempts.min - 1, false],
      [catalog.edge.maxAttempts.min, true],
      [catalog.edge.maxAttempts.max, true],
      [catalog.edge.maxAttempts.max + 1, false],
    ] as const) {
      const input = cloneInput();
      const policy = (edges(input)[0] as Mutable)['policy'] as Mutable;
      (policy['retry'] as Mutable)['maxAttempts'] = value;
      expect(topologySchema.safeParse(input).success).toBe(expected);
    }
  });

  it('rejects more nodes than the catalog allows', () => {
    const input = cloneInput();
    const template = nodes(input)[0] as Mutable;
    input['nodes'] = Array.from({ length: catalog.topology.maxNodes + 1 }, (_, index) => ({
      ...template,
      id: `node-${String(index)}`,
    }));
    expect(topologySchema.safeParse(input).success).toBe(false);
  });

  it('rejects a wrong schema version', () => {
    const input = cloneInput();
    input['schemaVersion'] = 2;
    expect(topologySchema.safeParse(input).success).toBe(false);
  });
});
