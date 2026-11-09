import { describe, expect, it } from 'vitest';
import type { Topology } from '@chaosboard/contracts';
import { detectHazards, composeSpokenOpinion } from '../domain/hazard-rules';

describe('detectHazards', () => {
  it('detects circular synchronous dependency cycles as critical hazards', () => {
    const topology: Topology = {
      schemaVersion: 1,
      id: 'topo-cyclic' as any,
      name: 'Cyclic Architecture',
      source: 'canvas',
      entry: { nodeId: 'profile-store' as any },
      nodes: [
        {
          id: 'profile-store' as any,
          label: 'Profile store',
          kind: 'service',
          processing: { distribution: 'constant', ms: 20 },
          concurrency: { maxWorkers: 20 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
        },
        {
          id: 'postgres-db' as any,
          label: 'Postgres DB',
          kind: 'service',
          processing: { distribution: 'constant', ms: 35 },
          concurrency: { maxWorkers: 5 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
        },
        {
          id: 'profile-service' as any,
          label: 'Profile service',
          kind: 'service',
          processing: { distribution: 'constant', ms: 20 },
          concurrency: { maxWorkers: 20 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
        },
      ],
      edges: [
        {
          id: 'edge-store-db' as any,
          source: 'profile-store' as any,
          target: 'postgres-db' as any,
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
          id: 'edge-db-service' as any,
          source: 'postgres-db' as any,
          target: 'profile-service' as any,
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
          id: 'edge-service-store' as any,
          source: 'profile-service' as any,
          target: 'profile-store' as any,
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
    };

    const hazards = detectHazards(topology);
    const cycleHazard = hazards.find((h) => h.title.includes('Circular Call Dependency'));
    expect(cycleHazard).toBeDefined();
    expect(cycleHazard?.severity).toBe('critical');
    expect(cycleHazard?.risk).toContain('Profile store -> Postgres DB -> Profile service -> Profile store');

    const spoken = composeSpokenOpinion(hazards, 'en', 3);
    expect(spoken).toContain('Circular synchronous RPC chain detected');
    expect(spoken).toContain('Profile store -> Postgres DB -> Profile service -> Profile store');
  });

  it('detects unmitigated retries and excessive timeouts', () => {
    const topology: Topology = {
      schemaVersion: 1,
      id: 'topo-timeout' as any,
      name: 'Timeout Topology',
      source: 'canvas',
      entry: { nodeId: 'gateway' as any },
      nodes: [
        {
          id: 'gateway' as any,
          label: 'Gateway',
          kind: 'service',
          processing: { distribution: 'constant', ms: 10 },
          concurrency: { maxWorkers: 20 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
        },
        {
          id: 'profile-service' as any,
          label: 'Profile service',
          kind: 'service',
          processing: { distribution: 'constant', ms: 20 },
          concurrency: { maxWorkers: 20 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
        },
      ],
      edges: [
        {
          id: 'edge-gw-profile' as any,
          source: 'gateway' as any,
          target: 'profile-service' as any,
          mode: 'sync_call',
          policy: {
            timeoutMs: 5000,
            retry: { maxAttempts: 2, backoffBaseMs: 50, backoffMultiplier: 2, maxBackoffMs: 500, jitter: 'none' },
            breaker: { enabled: false, failureThresholdPct: 50, windowRequests: 20, cooldownMs: 2000, halfOpenProbes: 2 },
            fallback: 'fail_fast_503',
            idempotency: { sendKey: false },
            pool: { maxConnections: 50 },
          },
        },
      ],
    };

    const hazards = detectHazards(topology);
    expect(hazards.length).toBe(2);
    expect(hazards.some((h) => h.title.includes('Timeout'))).toBe(true);
    expect(hazards.some((h) => h.title.includes('Retry Storm'))).toBe(true);
  });

  it('detects queue consumer sync mode mismatch and provides async_enqueue patch', () => {
    const topology: Topology = {
      schemaVersion: 1,
      id: 'topo-queue-sync' as any,
      name: 'Queue Sync Mismatch',
      source: 'canvas',
      entry: { nodeId: 'gateway' as any },
      nodes: [
        {
          id: 'gateway' as any,
          label: 'API Gateway',
          kind: 'service',
          processing: { distribution: 'constant', ms: 10 },
          concurrency: { maxWorkers: 20 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
        },
        {
          id: 'worker' as any,
          label: 'Queue Worker',
          kind: 'queue_consumer',
          processing: { distribution: 'constant', ms: 25 },
          concurrency: { maxWorkers: 10 },
          queue: { mode: 'bounded', maxDepth: 100 },
          consumeRateRps: 50,
          ingressRateLimitRps: null,
        },
      ],
      edges: [
        {
          id: 'edge-gw-worker' as any,
          source: 'gateway' as any,
          target: 'worker' as any,
          mode: 'sync_call', // Violates queue_consumer preflight rule!
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
    };

    const hazards = detectHazards(topology);
    const queueMismatch = hazards.find((h) => h.id === 'consumer-sync-edge-gw-worker');
    expect(queueMismatch).toBeDefined();
    expect(queueMismatch?.severity).toBe('critical');
    expect(queueMismatch?.patch?.mode).toBe('async_enqueue');
  });

  it('detects self-loop recursion deadlocks', () => {
    const topology: Topology = {
      schemaVersion: 1,
      id: 'topo-self-loop' as any,
      name: 'Self Loop',
      source: 'canvas',
      entry: { nodeId: 'service-a' as any },
      nodes: [
        {
          id: 'service-a' as any,
          label: 'Service A',
          kind: 'service',
          processing: { distribution: 'constant', ms: 10 },
          concurrency: { maxWorkers: 20 },
          queue: { mode: 'bounded', maxDepth: 100 },
          ingressRateLimitRps: null,
        },
      ],
      edges: [
        {
          id: 'edge-self' as any,
          source: 'service-a' as any,
          target: 'service-a' as any,
          mode: 'sync_call',
          policy: {
            timeoutMs: 500,
            retry: { maxAttempts: 0, backoffBaseMs: 50, backoffMultiplier: 2, maxBackoffMs: 500, jitter: 'none' },
            breaker: { enabled: false, failureThresholdPct: 50, windowRequests: 20, cooldownMs: 2000, halfOpenProbes: 2 },
            fallback: 'fail_fast_503',
            idempotency: { sendKey: false },
            pool: { maxConnections: 50 },
          },
        },
      ],
    };

    const hazards = detectHazards(topology);
    expect(hazards.some((h) => h.id === 'self-loop-edge-self')).toBe(true);
  });
});

