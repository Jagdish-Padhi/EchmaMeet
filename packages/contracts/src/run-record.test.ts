import { describe, it, expect } from 'vitest';
import { runRecordSchema, runSummarySchema } from './run-record';
import { runIdSchema } from './ids';

describe('run record contract', () => {
  const runId = runIdSchema.parse('run-12345678-1234-1234-1234-123456789abc');

  const baseRecord = {
    id: runId,
    status: 'completed' as const,
    topology: {
      schemaVersion: 1 as const,
      id: 'simple-topo',
      name: 'Simple Topo',
      source: 'scenario' as const,
      entry: { nodeId: 'node-a' },
      nodes: [
        {
          id: 'node-a',
          label: 'Node A',
          kind: 'service' as const,
          processing: { distribution: 'constant' as const, ms: 10 },
          concurrency: { maxWorkers: 5 },
          queue: { mode: 'bounded' as const, maxDepth: 10 },
          ingressRateLimitRps: null,
        },
      ],
      edges: [],
    },
    faults: [],
    invariants: [],
    trialConfig: {
      arrivalRateRps: 10,
      arrivalProcess: 'constant' as const,
      warmupMs: 100,
      measurementMs: 1000,
      cooldownMs: 100,
      clientTimeoutMs: 1000,
      seed: 12345,
      trials: 2,
    },
    baselineAggregate: null,
    faultedAggregate: null,
    verdicts: [],
    overallStatus: 'PASS' as const,
    provenance: {
      gitCommit: 'abc1234',
      hostDescription: 'Test Host',
      nodeVersion: 'v22.13.0',
      toxiproxyVersion: '2.13.0',
      startedAt: '2026-10-30T00:00:00.000Z',
    },
    createdAt: '2026-10-30T00:00:00.000Z',
    finishedAt: '2026-10-30T00:00:05.000Z',
    errorMessage: null,
  };

  it('accepts valid run record', () => {
    const parsed = runRecordSchema.parse(baseRecord);
    expect(parsed.id).toBe(runId);
    expect(parsed.status).toBe('completed');
  });

  it('accepts valid run summary', () => {
    const summary = runSummarySchema.parse({
      id: runId,
      status: 'completed',
      overallStatus: 'PASS',
      topologyId: 'simple-topo',
      topologyName: 'Simple Topo',
      faultCount: 0,
      invariantCount: 0,
      createdAt: '2026-10-30T00:00:00.000Z',
      finishedAt: '2026-10-30T00:00:05.000Z',
    });
    expect(summary.topologyId).toBe('simple-topo');
  });

  it('rejects invalid run status', () => {
    expect(() =>
      runRecordSchema.parse({
        ...baseRecord,
        status: 'invalid_status',
      }),
    ).toThrow();
  });
});
