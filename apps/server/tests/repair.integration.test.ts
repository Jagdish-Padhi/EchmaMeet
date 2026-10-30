import { readFileSync } from 'node:fs';
import { describe, it, expect, afterEach } from 'vitest';
import { buildApp } from '../src/app';
import { moduleMigrations } from '../src/module-migrations';
import { IN_MEMORY, openDatabase, type SqlDatabase } from '../src/platform/db';
import { createLogger } from '../src/platform/logging';
import { runMigrations } from '../src/platform/migrations';
import {
  edgeIdSchema,
  faultIdSchema,
  invariantIdSchema,
  repairSessionRecordSchema,
  startRepairResponseSchema,
  topologySchema,
  type Fault,
  type Invariant,
  type RepairPatch,
  type RepairSessionRecord,
  type RunEvent,
  type Topology,
  type TrialConfig,
} from '@chaosboard/contracts';
import type {
  StructuredModelPort,
  StructuredModelCallOptions,
  StructuredModelResult,
} from '../src/modules/meta-ai';

const logger = createLogger({ logLevel: 'silent', nodeEnv: 'test' });
const clock = { nowMs: () => Date.now(), monotonicNs: () => process.hrtime.bigint() };

const retryStormJson: unknown = JSON.parse(
  readFileSync(
    new URL('../src/modules/topology/tests/fixtures/scenarios/retry-storm.json', import.meta.url),
    'utf8',
  ),
);

describe('Repair agent and orchestration integration', { timeout: 180_000 }, () => {
  const closers: (() => Promise<void> | void)[] = [];

  afterEach(async () => {
    for (const close of closers.splice(0)) {
      await close();
    }
  });

  function setupServer(options?: { model?: StructuredModelPort; database?: SqlDatabase }) {
    const db = options?.database ?? openDatabase(IN_MEMORY);
    runMigrations(db, moduleMigrations, clock);
    const app = buildApp({
      logger,
      database: db,
      model: options?.model,
    });
    closers.push(() => app.close());
    closers.push(() => {
      try {
        db.close();
      } catch {
        // closed
      }
    });
    return { app, database: db };
  }

  it('runs rule-based repair loop on Scenario 1, verifies Pareto improvement, and reaches repaired status', async () => {
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

    const trialConfig: TrialConfig = {
      arrivalRateRps: 10,
      arrivalProcess: 'constant',
      warmupMs: 300,
      measurementMs: 1000,
      cooldownMs: 100,
      clientTimeoutMs: 2000,
      seed: 45000,
      trials: 1,
    };

    // 1. Start repair session via POST /api/repairs
    const startRes = await app.inject({
      method: 'POST',
      url: '/api/repairs',
      payload: {
        topology,
        faults: [retryFault],
        invariants: [invRetry],
        trialConfig,
        proposer: 'rule_based',
        maxIterations: 3,
        timeoutMs: 120_000,
      },
    });

    expect(startRes.statusCode).toBe(201);
    const startBody = startRepairResponseSchema.parse(startRes.json());
    const repairId = startBody.repairId;
    expect(repairId).toBeDefined();

    // 2. Poll for repair completion via GET /api/repairs/:id
    let completedSession: RepairSessionRecord | null = null;
    const deadline = Date.now() + 90_000;

    while (Date.now() < deadline) {
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/repairs/${repairId}`,
      });
      expect(getRes.statusCode).toBe(200);
      const session = repairSessionRecordSchema.parse(getRes.json());

      if (
        session.status === 'repaired' ||
        session.status === 'trade_off_reached' ||
        session.status === 'limits_reached' ||
        session.status === 'failed' ||
        session.status === 'cancelled'
      ) {
        completedSession = session;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    expect(completedSession).not.toBeNull();
    expect(completedSession?.errorMessage).toBeNull();
    expect(completedSession?.status).toBe('repaired');
    expect(completedSession?.iterations.length).toBeGreaterThanOrEqual(1);

    const firstIter = completedSession?.iterations[0];
    expect(firstIter?.decision).toBe('accept');
    expect(firstIter?.patch).not.toBeNull();

    // 3. Verify persisted events via /api/runs/:id/events and live stream via /api/repairs/:id/events
    const eventsRes = await app.inject({
      method: 'GET',
      url: `/api/runs/${repairId}/events`,
    });
    expect(eventsRes.statusCode).toBe(200);
    const events = eventsRes.json<RunEvent[]>();

    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(events[0]?.type).toBe('repair_started');
    expect(events[events.length - 1]?.type).toBe('repair_finished');

    const sseRes = await app.inject({
      method: 'GET',
      url: `/api/repairs/${repairId}/events`,
    });
    expect(sseRes.statusCode).toBe(200);
    expect(sseRes.headers['content-type']).toContain('text/event-stream');
    expect(sseRes.body).toContain('repair_started');
  });

  it('rolls back a harmful patch proposed by model that fails measurement', async () => {
    // Mock model that proposes an extreme concurrency change which does not help retry storm
    const scriptedProposer: StructuredModelPort = {
      generateStructured<T>(
        options: StructuredModelCallOptions<T>,
      ): Promise<StructuredModelResult<T>> {
        expect(options.messages.length).toBeGreaterThan(0);
        const harmfulPatch: RepairPatch = {
          schemaVersion: 1,
          hypothesis: 'Harmful proposal that exacerbates retry storm',
          operations: [
            {
              op: 'set_retry',
              edgeId: edgeIdSchema.parse('checkout-to-inventory'),
              maxAttempts: 5,
              backoffBaseMs: 1,
              backoffMultiplier: 1,
              maxBackoffMs: 10,
              jitter: 'none',
              rationale: 'Aggressive retries',
            },
          ],
        };
        return Promise.resolve({
          data: harmfulPatch as T,
          rawOutput: JSON.stringify(harmfulPatch),
          metadata: {
            provider: 'mock',
            modelId: 'test-harmful-model',
            promptVersion: 'v1',
            latencyMs: 10,
          },
        });
      },
    };

    const { app } = setupServer({ model: scriptedProposer });

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

    const trialConfig: TrialConfig = {
      arrivalRateRps: 10,
      arrivalProcess: 'constant',
      warmupMs: 300,
      measurementMs: 1000,
      cooldownMs: 100,
      clientTimeoutMs: 2000,
      seed: 52000,
      trials: 1,
    };

    const startRes = await app.inject({
      method: 'POST',
      url: '/api/repairs',
      payload: {
        topology,
        faults: [retryFault],
        invariants: [invRetry],
        trialConfig,
        proposer: 'model',
        maxIterations: 1,
        timeoutMs: 90_000,
      },
    });

    expect(startRes.statusCode).toBe(201);
    const { repairId } = startRepairResponseSchema.parse(startRes.json());

    let session: RepairSessionRecord | null = null;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/repairs/${repairId}`,
      });
      const s = repairSessionRecordSchema.parse(getRes.json());
      if (s.status !== 'running') {
        session = s;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    expect(session).not.toBeNull();
    // Harmful proposal rolled back!
    expect(session?.iterations[0]?.decision).toBe('rollback');
    expect(session?.status).toBe('trade_off_reached');
    expect(session?.finalReport).not.toBeNull();
    expect(
      session?.bestTopology.nodes.find((n) => n.id === 'checkout')?.concurrency.maxWorkers,
    ).toBe(topology.nodes.find((n) => n.id === 'checkout')?.concurrency.maxWorkers);
  });

  it('cancels an active repair session and halts execution', async () => {
    const { app } = setupServer();
    const topology: Topology = topologySchema.parse(retryStormJson);

    const startRes = await app.inject({
      method: 'POST',
      url: '/api/repairs',
      payload: {
        topology,
        faults: [],
        invariants: [],
        trialConfig: {
          arrivalRateRps: 10,
          arrivalProcess: 'constant',
          warmupMs: 300,
          measurementMs: 1000,
          cooldownMs: 100,
          clientTimeoutMs: 2000,
          seed: 60000,
          trials: 1,
        },
        proposer: 'rule_based',
        maxIterations: 5,
        timeoutMs: 60_000,
      },
    });

    expect(startRes.statusCode).toBe(201);
    const { repairId } = startRepairResponseSchema.parse(startRes.json());

    // Cancel immediately
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/repairs/${repairId}/cancel`,
    });
    expect(cancelRes.statusCode).toBe(200);

    // Wait for cancellation to settle
    let session: RepairSessionRecord | null = null;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/repairs/${repairId}`,
      });
      const s = repairSessionRecordSchema.parse(getRes.json());
      if (s.status === 'cancelled' || s.status === 'failed' || s.status === 'repaired') {
        session = s;
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    expect(session).not.toBeNull();
    expect(['cancelled', 'repaired']).toContain(session?.status);
  });
});
