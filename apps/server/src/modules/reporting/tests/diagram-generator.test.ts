import { describe, expect, it } from 'vitest';
import { generateDeterministicTopologySvg } from '../domain/diagram-generator';
import {
  topologyIdSchema,
  nodeIdSchema,
  edgeIdSchema,
  faultIdSchema,
  type Topology,
  type Fault,
} from '@chaosboard/contracts';

describe('diagram-generator domain', () => {
  const dummyTopoId = topologyIdSchema.parse('test-topo');
  const dummyClientId = nodeIdSchema.parse('client');
  const dummyServerId = nodeIdSchema.parse('server');
  const dummyEdgeId = edgeIdSchema.parse('client-to-server');
  const dummyFaultId = faultIdSchema.parse('fault-1');

  const topology: Topology = {
    schemaVersion: 1,
    id: dummyTopoId,
    name: 'Test Topology',
    source: 'scenario',
    entry: { nodeId: dummyClientId },
    nodes: [
      {
        id: dummyClientId,
        label: 'Client Service',
        kind: 'service',
        processing: { distribution: 'constant', ms: 10 },
        concurrency: { maxWorkers: 10 },
        queue: { mode: 'bounded', maxDepth: 50 },
        ingressRateLimitRps: null,
      },
      {
        id: dummyServerId,
        label: 'Server Service',
        kind: 'service',
        processing: { distribution: 'constant', ms: 50 },
        concurrency: { maxWorkers: 10 },
        queue: { mode: 'bounded', maxDepth: 50 },
        ingressRateLimitRps: null,
      },
    ],
    edges: [
      {
        id: dummyEdgeId,
        source: dummyClientId,
        target: dummyServerId,
        mode: 'sync_call',
        policy: {
          timeoutMs: 1000,
          retry: {
            maxAttempts: 1,
            backoffBaseMs: 0,
            backoffMultiplier: 1,
            maxBackoffMs: 0,
            jitter: 'none',
          },
          breaker: {
            enabled: false,
            failureThresholdPct: 50,
            windowRequests: 10,
            cooldownMs: 5000,
            halfOpenProbes: 1,
          },
          fallback: 'fail_fast_503',
          idempotency: { sendKey: false },
          pool: { maxConnections: 10 },
        },
      },
    ],
  };

  const faults: Fault[] = [
    {
      id: dummyFaultId,
      type: 'latency',
      edgeId: dummyEdgeId,
      toxicity: 1,
      direction: 'downstream',
      startOffsetMs: 0,
      latencyMs: 500,
      jitterMs: 100,
    },
  ];

  it('generates valid SVG with nodes, edges, and fault highlights', () => {
    const svg = generateDeterministicTopologySvg({
      topology,
      faults,
    });

    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('Client Service');
    expect(svg).toContain('Server Service');
    expect(svg).toContain('LATENCY');
    expect(svg).toContain('+500ms');
  });

  it('produces identical SVG output on repeated invocations (pure and deterministic)', () => {
    const svg1 = generateDeterministicTopologySvg({ topology, faults });
    const svg2 = generateDeterministicTopologySvg({ topology, faults });
    expect(svg1).toBe(svg2);
  });
});
