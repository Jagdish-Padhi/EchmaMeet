import { describe, expect, it } from 'vitest';
import { edgeIdSchema, nodeIdSchema, topologyIdSchema } from '@chaosboard/contracts';
import type { BoardState } from '../../board/types';
import { detectSreHazards } from '../useMeetingSreWatcher';

describe('detectSreHazards', () => {
  it('detects un-jittered immediate retries as a critical retry storm hazard', () => {
    const board: BoardState = {
      id: topologyIdSchema.parse('test-room-top'),
      name: 'Test Topology',
      entryNodeId: nodeIdSchema.parse('gateway'),
      nodes: [
        {
          id: nodeIdSchema.parse('gateway'),
          label: 'Gateway',
          kind: 'service',
          processing: { distribution: 'constant', ms: 10 },
          concurrency: { maxWorkers: 20 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
          position: { x: 100, y: 150 },
        },
        {
          id: nodeIdSchema.parse('auth-service'),
          label: 'Auth Service',
          kind: 'service',
          processing: { distribution: 'constant', ms: 15 },
          concurrency: { maxWorkers: 10 },
          queue: { mode: 'bounded', maxDepth: 50 },
          ingressRateLimitRps: null,
          position: { x: 360, y: 150 },
        },
      ],
      edges: [
        {
          id: edgeIdSchema.parse('edge-gateway-auth'),
          source: nodeIdSchema.parse('gateway'),
          target: nodeIdSchema.parse('auth-service'),
          mode: 'sync_call',
          policy: {
            timeoutMs: 500,
            retry: {
              maxAttempts: 3,
              backoffBaseMs: 50,
              backoffMultiplier: 2,
              maxBackoffMs: 500,
              jitter: 'none', // Critical anti-pattern!
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
      selectedNodeId: null,
      selectedEdgeId: null,
      validationProblems: [],
      isValidating: false,
      isDirty: false,
    };

    const hazards = detectSreHazards(board);
    expect(hazards.length).toBeGreaterThanOrEqual(1);
    const retryHazard = hazards.find((h) => h.title.includes('Retry Storm'));
    expect(retryHazard).toBeDefined();
    expect(retryHazard?.severity).toBe('critical');
    expect(retryHazard?.patch?.retry?.jitter).toBe('full');
    expect(retryHazard?.patch?.breaker?.enabled).toBe(true);
  });

  it('detects circular synchronous dependency cycles as critical hazards', () => {
    const cyclicBoard: BoardState = {
      id: topologyIdSchema.parse('cyclic-top'),
      name: 'Cyclic Topology',
      entryNodeId: nodeIdSchema.parse('profile-store'),
      nodes: [
        {
          id: nodeIdSchema.parse('profile-store'),
          label: 'Profile store',
          kind: 'service',
          processing: { distribution: 'constant', ms: 20 },
          concurrency: { maxWorkers: 20 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
          position: { x: 100, y: 150 },
        },
        {
          id: nodeIdSchema.parse('postgres-db'),
          label: 'Postgres DB',
          kind: 'service',
          processing: { distribution: 'constant', ms: 35 },
          concurrency: { maxWorkers: 5 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
          position: { x: 300, y: 150 },
        },
        {
          id: nodeIdSchema.parse('profile-service'),
          label: 'Profile service',
          kind: 'service',
          processing: { distribution: 'constant', ms: 20 },
          concurrency: { maxWorkers: 20 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
          position: { x: 500, y: 150 },
        },
      ],
      edges: [
        {
          id: edgeIdSchema.parse('edge-store-db'),
          source: nodeIdSchema.parse('profile-store'),
          target: nodeIdSchema.parse('postgres-db'),
          mode: 'sync_call',
          policy: {
            timeoutMs: 500,
            retry: { maxAttempts: 1, backoffBaseMs: 50, backoffMultiplier: 2, maxBackoffMs: 500, jitter: 'full' },
            breaker: { enabled: true, failureThresholdPct: 50, windowRequests: 20, cooldownMs: 2000, halfOpenProbes: 2 },
            fallback: 'fail_fast_503',
            idempotency: { sendKey: false },
            pool: { maxConnections: 50 },
          },
        },
        {
          id: edgeIdSchema.parse('edge-db-service'),
          source: nodeIdSchema.parse('postgres-db'),
          target: nodeIdSchema.parse('profile-service'),
          mode: 'sync_call',
          policy: {
            timeoutMs: 500,
            retry: { maxAttempts: 1, backoffBaseMs: 50, backoffMultiplier: 2, maxBackoffMs: 500, jitter: 'full' },
            breaker: { enabled: true, failureThresholdPct: 50, windowRequests: 20, cooldownMs: 2000, halfOpenProbes: 2 },
            fallback: 'fail_fast_503',
            idempotency: { sendKey: false },
            pool: { maxConnections: 50 },
          },
        },
        {
          id: edgeIdSchema.parse('edge-service-store'),
          source: nodeIdSchema.parse('profile-service'),
          target: nodeIdSchema.parse('profile-store'),
          mode: 'sync_call',
          policy: {
            timeoutMs: 500,
            retry: { maxAttempts: 1, backoffBaseMs: 50, backoffMultiplier: 2, maxBackoffMs: 500, jitter: 'full' },
            breaker: { enabled: true, failureThresholdPct: 50, windowRequests: 20, cooldownMs: 2000, halfOpenProbes: 2 },
            fallback: 'fail_fast_503',
            idempotency: { sendKey: false },
            pool: { maxConnections: 50 },
          },
        },
      ],
      selectedNodeId: null,
      selectedEdgeId: null,
      validationProblems: [],
      isValidating: false,
      isDirty: false,
    };

    const hazards = detectSreHazards(cyclicBoard);
    const cycleHazard = hazards.find((h) => h.title.includes('Circular Call Dependency'));
    expect(cycleHazard).toBeDefined();
    expect(cycleHazard?.severity).toBe('critical');
    expect(cycleHazard?.risk).toContain('Profile store -> Postgres DB -> Profile service -> Profile store');
  });

  it('reports zero hazards when topology has resilient policies', () => {
    const resilientBoard: BoardState = {
      id: topologyIdSchema.parse('resilient-top'),
      name: 'Resilient Topology',
      entryNodeId: nodeIdSchema.parse('gateway'),
      nodes: [
        {
          id: nodeIdSchema.parse('gateway'),
          label: 'Gateway',
          kind: 'service',
          processing: { distribution: 'constant', ms: 10 },
          concurrency: { maxWorkers: 20 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
          position: { x: 100, y: 150 },
        },
      ],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      validationProblems: [],
      isValidating: false,
      isDirty: false,
    };

    const hazards = detectSreHazards(resilientBoard);
    expect(hazards.length).toBe(0);
  });
});
