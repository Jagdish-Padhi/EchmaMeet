import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase, IN_MEMORY, type SqlDatabase } from '../../../platform/db';
import { runMigrations } from '../../../platform/migrations';
import type { Clock } from '@chaosboard/shared';
import { runsMigrations, createRunsService, type RunsService } from '../index';

const clock: Clock = { nowMs: () => Date.now(), monotonicNs: () => process.hrtime.bigint() };
import {
  runIdSchema,
  topologySchema,
  type RunRecord,
  type RunEvent,
  type TrialResult,
} from '@chaosboard/contracts';

describe('runs module persistence', () => {
  let db: SqlDatabase;
  let runsService: RunsService;

  beforeEach(() => {
    db = openDatabase(IN_MEMORY);
    runMigrations(db, [runsMigrations], clock);
    runsService = createRunsService(db);
  });

  afterEach(() => {
    db.close();
  });

  const runId = runIdSchema.parse('run-12345678-1234-1234-1234-123456789abc');

  const sampleRun: RunRecord = {
    id: runId,
    status: 'running',
    topology: topologySchema.parse({
      schemaVersion: 1,
      id: 'simple-topo',
      name: 'Simple Topo',
      source: 'scenario',
      entry: { nodeId: 'node-a' },
      nodes: [
        {
          id: 'node-a',
          label: 'Node A',
          kind: 'service',
          processing: { distribution: 'constant', ms: 10 },
          concurrency: { maxWorkers: 5 },
          queue: { mode: 'bounded', maxDepth: 10 },
          ingressRateLimitRps: null,
        },
      ],
      edges: [],
    }),
    faults: [],
    invariants: [],
    trialConfig: {
      arrivalRateRps: 10,
      arrivalProcess: 'constant',
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
    overallStatus: null,
    provenance: {
      gitCommit: 'abc1234',
      hostDescription: 'Test Host',
      nodeVersion: 'v22.13.0',
      toxiproxyVersion: '2.13.0',
      startedAt: '2026-10-30T00:00:00.000Z',
    },
    createdAt: '2026-10-30T00:00:00.000Z',
    finishedAt: null,
    errorMessage: null,
  };

  it('creates and retrieves a run record', () => {
    runsService.createRun(sampleRun);
    const retrieved = runsService.getRun(runId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(runId);
    expect(retrieved?.status).toBe('running');
    expect(retrieved?.topology.id).toBe('simple-topo');
  });

  it('updates run status and completion details', () => {
    runsService.createRun(sampleRun);
    runsService.updateRunStatus(runId, 'completed', {
      finishedAt: '2026-10-30T00:00:05.000Z',
      overallStatus: 'PASS',
      verdicts: [],
    });

    const retrieved = runsService.getRun(runId);
    expect(retrieved?.status).toBe('completed');
    expect(retrieved?.overallStatus).toBe('PASS');
    expect(retrieved?.finishedAt).toBe('2026-10-30T00:00:05.000Z');
  });

  it('appends and lists events in sequence order', () => {
    runsService.createRun(sampleRun);

    const event1: RunEvent = {
      runId,
      sequence: 0,
      timestampMs: 1000,
      type: 'experiment_started',
      payload: { phase: 'init' },
    };
    const event2: RunEvent = {
      runId,
      sequence: 1,
      timestampMs: 1500,
      type: 'sandbox_ready',
      payload: { nodes: 1 },
    };

    runsService.appendEvent(event1);
    runsService.appendEvent(event2);

    const events = runsService.getEvents(runId);
    expect(events.length).toBe(2);
    expect(events[0]?.sequence).toBe(0);
    expect(events[0]?.type).toBe('experiment_started');
    expect(events[1]?.sequence).toBe(1);
    expect(events[1]?.type).toBe('sandbox_ready');
  });

  it('appends and separates trials by phase', () => {
    runsService.createRun(sampleRun);

    const makeTrial = (index: number): TrialResult => ({
      trialIndex: index,
      seed: 1000 + index,
      validity: { valid: true, reason: null },
      metrics: {
        p99LatencyMs: 50,
        p50LatencyMs: 25,
        completionRate: 1,
        retryAmplification: {},
        workerSaturation: {},
        maxQueueDepth: {},
        duplicateWriteRate: null,
        breakerOpenFraction: {},
      },
      diagnostics: {
        generatorLag: { minMs: 0, maxMs: 1, meanMs: 0.5, p50Ms: 0.5, p90Ms: 0.8, p99Ms: 0.9 },
        generatorEventLoopDelay: {
          minMs: 0,
          maxMs: 1,
          meanMs: 0.2,
          p50Ms: 0.2,
          p90Ms: 0.5,
          p99Ms: 0.8,
        },
        workerEventLoopDelays: {},
        totalScheduledRequests: 10,
        totalCompletedRequests: 10,
      },
    });

    runsService.appendTrial(runId, 'baseline', makeTrial(0));
    runsService.appendTrial(runId, 'faulted', makeTrial(0));

    const trials = runsService.getTrials(runId);
    expect(trials.baseline.length).toBe(1);
    expect(trials.faulted.length).toBe(1);
    expect(trials.baseline[0]?.trialIndex).toBe(0);
  });

  it('lists run summaries', () => {
    runsService.createRun(sampleRun);
    const list = runsService.listRuns();
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe(runId);
    expect(list[0]?.topologyId).toBe('simple-topo');
    expect(list[0]?.status).toBe('running');
  });
});
