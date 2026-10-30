import { nodeIdSchema, topologySchema, type Topology } from '@chaosboard/contracts';
import { describe, expect, it } from 'vitest';
import { deriveNodeConfigurations } from '../derive-config';
import { allocateNetworkPlan } from '../plan';

describe('deriveNodeConfigurations', () => {
  const gatewayId = nodeIdSchema.parse('gateway');
  const backendId = nodeIdSchema.parse('backend');

  const sampleTopology: Topology = topologySchema.parse({
    schemaVersion: 1,
    id: 'topo-derive',
    name: 'Derive Topo',
    source: 'scenario',
    entry: { nodeId: 'gateway' },
    nodes: [
      {
        id: 'gateway',
        label: 'Gateway',
        kind: 'service',
        processing: { distribution: 'constant', ms: 10 },
        concurrency: { maxWorkers: 20 },
        queue: { mode: 'bounded', maxDepth: 50 },
        ingressRateLimitRps: null,
      },
      {
        id: 'backend',
        label: 'Backend',
        kind: 'service',
        processing: { distribution: 'constant', ms: 20 },
        concurrency: { maxWorkers: 10 },
        queue: { mode: 'bounded', maxDepth: 20 },
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

  const plan = allocateNetworkPlan(sampleTopology, {
    baseNodePort: 21000,
    baseProxyPort: 28000,
  });

  it('derives configurations for all nodes targeting proxy URLs when useProxies is true', () => {
    const configs = deriveNodeConfigurations(sampleTopology, plan, { useProxies: true });

    expect(configs.size).toBe(2);

    const gatewayConfig = configs.get(gatewayId);
    expect(gatewayConfig).toBeDefined();
    expect(gatewayConfig?.listenPort).toBe(21000);
    expect(gatewayConfig?.outgoingEdges).toHaveLength(1);
    expect(gatewayConfig?.outgoingEdges[0]?.targetUrl).toBe('http://127.0.0.1:28000/request');

    const backendConfig = configs.get(backendId);
    expect(backendConfig).toBeDefined();
    expect(backendConfig?.listenPort).toBe(21001);
    expect(backendConfig?.outgoingEdges).toHaveLength(0);
  });

  it('derives configurations targeting direct node ports when useProxies is false', () => {
    const configs = deriveNodeConfigurations(sampleTopology, plan, { useProxies: false });

    const gatewayConfig = configs.get(gatewayId);
    expect(gatewayConfig).toBeDefined();
    expect(gatewayConfig?.outgoingEdges[0]?.targetUrl).toBe('http://127.0.0.1:21001/request');
  });

  it('assigns unique seeds to each node derived from the base seed', () => {
    const configs = deriveNodeConfigurations(sampleTopology, plan, { baseSeed: 12345 });

    const gatewaySeed = configs.get(gatewayId)?.seed;
    const backendSeed = configs.get(backendId)?.seed;

    expect(gatewaySeed).toBeDefined();
    expect(backendSeed).toBeDefined();
    expect(gatewaySeed).not.toBe(backendSeed);
  });
});

