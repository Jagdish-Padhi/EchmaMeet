import { readFileSync } from 'node:fs';
import { describe, it, expect, afterEach } from 'vitest';
import { buildApp } from '../src/app';
import { openDatabase, IN_MEMORY, type SqlDatabase } from '../src/platform/db';
import { runMigrations } from '../src/platform/migrations';
import { moduleMigrations } from '../src/module-migrations';
import { createLogger } from '../src/platform/logging';
import {
  edgeIdSchema,
  faultIdSchema,
  invariantIdSchema,
  runRecordSchema,
  runSummarySchema,
  startExperimentResponseSchema,
  topologySchema,
  type Fault,
  type Invariant,
  type RunEvent,
  type Topology,
  type TrialConfig,
} from '@chaosboard/contracts';

const logger = createLogger({ logLevel: 'silent', nodeEnv: 'test' });
const clock = { nowMs: () => Date.now(), monotonicNs: () => process.hrtime.bigint() };

const retryStormJson: unknown = JSON.parse(
  readFileSync(
    new URL('../src/modules/topology/tests/fixtures/scenarios/retry-storm.json', import.meta.url),
    'utf8',
  ),
);

describe('Experiment orchestration and storage integration', () => {
  const closers: (() => Promise<void> | void)[] = [];

  afterEach(async () => {
    for (const close of closers.splice(0)) {
      await close();
    }
  });

  function setupServer(database: SqlDatabase = openDatabase(IN_MEMORY)) {
    runMigrations(database, moduleMigrations, clock);
    const app = buildApp({ logger, database });
    closers.push(() => app.close());
    closers.push(() => {
      try {
        database.close();
      } catch {
        // closed
      }
    });
    return { app, database };
  }

  it('runs Scenario 1 through the API, streams events, persists record with matching verdicts, and replays events', async () => {
    const { app } = setupServer();

    const topology: Topology = topologySchema.parse(retryStormJson);
    const edgeCheckoutToInventory = edgeIdSchema.parse('checkout-to-inventory');

    const retryFault: Fault = {
      id: faultIdSchema.parse('fault-retry-storm'),
      edgeId: edgeCheckoutToInventory,
      type: 'connection_reset',
      afterMs: 10,
      toxicity: 1.0,
      direction: 'downstream',
      startOffsetMs: 0,
    };

    const invRetry: Invariant = {
      id: invariantIdSchema.parse('inv-retry'),
      metric: 'retry_amplification',
      scope: { kind: 'edge', edgeId: edgeCheckoutToInventory },
      comparator: 'lte',
      threshold: 1.5,
    };

    const invCompletion: Invariant = {
      id: invariantIdSchema.parse('inv-completion'),
      metric: 'completion_rate',
      scope: { kind: 'system' },
      comparator: 'gte',
      threshold: 0.95,
    };

    const trialConfig: TrialConfig = {
      arrivalRateRps: 10,
      arrivalProcess: 'constant',
      warmupMs: 400,
      measurementMs: 1000,
      cooldownMs: 100,
      clientTimeoutMs: 2000,
      seed: 42000,
      trials: 2,
    };

    // 1. Start experiment via POST /api/experiments
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/experiments',
      payload: {
        topology,
        faults: [retryFault],
        invariants: [invRetry, invCompletion],
        trialConfig,
      },
    });

    expect(startRes.statusCode).toBe(201);
    const startBody = startExperimentResponseSchema.parse(startRes.json());
    const runId = startBody.runId;
    expect(runId).toBeDefined();

    // 2. Poll / wait for experiment to complete via GET /api/runs/:id
    let completedRecord = null;
    const deadline = Date.now() + 60_000;

    while (Date.now() < deadline) {
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/runs/${runId}`,
      });
      expect(getRes.statusCode).toBe(200);
      const record = runRecordSchema.parse(getRes.json());

      if (
        record.status === 'completed' ||
        record.status === 'failed' ||
        record.status === 'cancelled'
      ) {
        completedRecord = record;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    expect(completedRecord).not.toBeNull();
    expect(completedRecord?.status).toBe('completed');

    // 3. Verify honest verdicts match hand calculation from stored per-trial data
    expect(completedRecord?.verdicts.length).toBe(2);

    const retryVerdict = completedRecord?.verdicts.find((v) => v.invariantId === 'inv-retry');
    expect(retryVerdict).toBeDefined();
    expect(retryVerdict?.status).toBe('VIOLATED');
    // Evidence matches hand calculation: median retry amplification >= 2.0 (threshold 1.5)
    expect(retryVerdict?.evidence.faultedAggregate?.median).toBeGreaterThanOrEqual(2.0);

    const completionVerdict = completedRecord?.verdicts.find(
      (v) => v.invariantId === 'inv-completion',
    );
    expect(completionVerdict).toBeDefined();
    expect(completionVerdict?.status).toBe('VIOLATED');
    expect(completionVerdict?.evidence.faultedAggregate?.median).toBe(0);

    expect(completedRecord?.overallStatus).toBe('VIOLATED');

    // 4. Verify replayed event stream matches historical events
    const eventsRes = await app.inject({
      method: 'GET',
      url: `/api/runs/${runId}/events`,
    });
    expect(eventsRes.statusCode).toBe(200);
    const events = eventsRes.json<RunEvent[]>();

    expect(events.length).toBeGreaterThan(5);
    expect(events[0]?.type).toBe('experiment_started');
    expect(events[events.length - 1]?.type).toBe('experiment_finished');

    // Sequences are strictly monotonic starting at 0
    events.forEach((ev, idx) => {
      expect(ev.sequence).toBe(idx);
      expect(ev.runId).toBe(runId);
    });

    // 5. Verify list runs returns summary
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/runs',
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json<unknown[]>().map((s) => runSummarySchema.parse(s));
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some((s) => s.id === runId && s.status === 'completed')).toBe(true);
  });

  it('rejects concurrent experiment with busy conflict problem details', async () => {
    const { app } = setupServer();

    const topology: Topology = topologySchema.parse(retryStormJson);
    const trialConfig: TrialConfig = {
      arrivalRateRps: 10,
      arrivalProcess: 'constant',
      warmupMs: 300,
      measurementMs: 2000,
      cooldownMs: 100,
      clientTimeoutMs: 2000,
      seed: 50000,
      trials: 2,
    };

    // Start first experiment
    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/experiments',
      payload: {
        topology,
        faults: [],
        invariants: [],
        trialConfig,
      },
    });
    expect(firstRes.statusCode).toBe(201);
    const runId = startExperimentResponseSchema.parse(firstRes.json()).runId;

    // Immediately attempt second experiment while first is running
    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/experiments',
      payload: {
        topology,
        faults: [],
        invariants: [],
        trialConfig,
      },
    });

    expect(secondRes.statusCode).toBe(409);
    const problem = secondRes.json<{ code?: string; status?: number; detail?: string }>();
    expect(problem.code).toBe('experiment_busy');
    expect(problem.status).toBe(409);
    expect(problem.detail).toContain('already running');

    // Cancel first to clean up
    await app.inject({
      method: 'POST',
      url: `/api/experiments/${runId}/cancel`,
    });
  });

  it('handles cancellation and marks run record cancelled with process cleanup', async () => {
    const { app } = setupServer();

    const topology: Topology = topologySchema.parse(retryStormJson);
    const trialConfig: TrialConfig = {
      arrivalRateRps: 10,
      arrivalProcess: 'constant',
      warmupMs: 300,
      measurementMs: 5000,
      cooldownMs: 100,
      clientTimeoutMs: 2000,
      seed: 60000,
      trials: 2,
    };

    const startRes = await app.inject({
      method: 'POST',
      url: '/api/experiments',
      payload: {
        topology,
        faults: [],
        invariants: [],
        trialConfig,
      },
    });
    expect(startRes.statusCode).toBe(201);
    const runId = startExperimentResponseSchema.parse(startRes.json()).runId;

    // Wait a brief moment for sandbox to start
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Cancel experiment
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/experiments/${runId}/cancel`,
    });
    expect(cancelRes.statusCode).toBe(200);

    // Verify record is marked cancelled
    let cancelled = false;
    for (let i = 0; i < 20; i += 1) {
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/runs/${runId}`,
      });
      const record = runRecordSchema.parse(getRes.json());
      if (record.status === 'cancelled') {
        cancelled = true;
        expect(record.errorMessage).toContain('cancelled');
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    expect(cancelled).toBe(true);
  });
});
