import { describe, expect, it } from 'vitest';
import {
  nodeIdSchema,
  topologyIdSchema,
  type EdgeId,
  type NodeId,
  type Topology,
} from '@chaosboard/contracts';
import { fromTopology, toTopologyDraft, type BoardState } from '../types';

describe('Board state conversions', () => {
  it('converts topology to initial board layout and back to draft', () => {
    const topology: Topology = {
      schemaVersion: 1,
      id: topologyIdSchema.parse('test-top'),
      name: 'Test Topology',
      source: 'scenario',
      entry: { nodeId: nodeIdSchema.parse('gateway') },
      nodes: [
        {
          id: nodeIdSchema.parse('gateway'),
          label: 'Gateway',
          kind: 'service',
          processing: { distribution: 'constant', ms: 10 },
          concurrency: { maxWorkers: 20 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
        },
        {
          id: nodeIdSchema.parse('worker'),
          label: 'Worker',
          kind: 'service',
          processing: { distribution: 'constant', ms: 25 },
          concurrency: { maxWorkers: 10 },
          queue: { mode: 'unbounded' },
          ingressRateLimitRps: null,
        },
      ],
      edges: [
        {
          id: 'gateway->worker' as EdgeId,
          source: 'gateway' as NodeId,
          target: 'worker' as NodeId,
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

    const board: BoardState = fromTopology(topology);
    expect(board.nodes.length).toBe(2);
    expect(board.edges.length).toBe(1);
    expect(board.nodes[0]?.position.x).toBe(100);
    expect(board.nodes[1]?.position.x).toBe(360);
    expect(board.edgeSourcePorts).toEqual({});
    expect(board.edgeTargetPorts).toEqual({});

    const draft = toTopologyDraft(board);
    expect(draft.name).toBe('Test Topology');
    expect(draft.nodes.length).toBe(2);
    expect(draft.edges[0]?.sourceRef).toBe('gateway');
  });
});
