import { afterEach, describe, expect, it } from 'vitest';
import {
  reportExportSchema,
  blueprintCardSchema,
  runIdSchema,
  topologyIdSchema,
  nodeIdSchema,
  type RunRecord,
} from '@chaosboard/contracts';
import { buildApp } from '../src/app';
import { moduleMigrations } from '../src/module-migrations';
import { IN_MEMORY, openDatabase, type SqlDatabase } from '../src/platform/db';
import { createLogger } from '../src/platform/logging';
import { runMigrations } from '../src/platform/migrations';
import { systemClock } from '../src/platform/system-clock';
import { createRunsService } from '../src/modules/runs';

const logger = createLogger({
  logLevel: 'silent',
  nodeEnv: 'test',
});

describe('Reporting HTTP API Integration', () => {
  const closers: (() => Promise<void> | void)[] = [];

  afterEach(async () => {
    for (const close of closers.splice(0)) {
      await close();
    }
  });

  function setupServer() {
    const database: SqlDatabase = openDatabase(IN_MEMORY);
    runMigrations(database, moduleMigrations, systemClock);
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

  const dummyRunId = runIdSchema.parse('run-11111111-2222-3333-4444-555555555555');
  const dummyTopoId = topologyIdSchema.parse('test-topo');
  const dummyNodeId = nodeIdSchema.parse('gateway');

  const sampleRun: RunRecord = {
    id: dummyRunId,
    status: 'completed',
    topology: {
      schemaVersion: 1,
      id: dummyTopoId,
      name: 'Gateway Service Topology',
      source: 'scenario',
      entry: { nodeId: dummyNodeId },
      nodes: [
        {
          id: dummyNodeId,
          label: 'Gateway',
          kind: 'service',
          processing: { distribution: 'constant', ms: 15 },
          concurrency: { maxWorkers: 10 },
          queue: { mode: 'bounded', maxDepth: 20 },
          ingressRateLimitRps: null,
        },
      ],
      edges: [],
    },
    faults: [],
    invariants: [],
    trialConfig: {
      arrivalRateRps: 10,
      arrivalProcess: 'constant',
      warmupMs: 100,
      measurementMs: 1000,
      cooldownMs: 100,
      clientTimeoutMs: 1000,
      seed: 42,
      trials: 1,
    },
    baselineAggregate: null,
    faultedAggregate: null,
    verdicts: [],
    overallStatus: 'PASS',
    provenance: {
      gitCommit: 'abc1234',
      hostDescription: 'Integration Test Host',
      nodeVersion: 'v22.13.0',
      toxiproxyVersion: '2.13.0',
      startedAt: '2026-10-30T00:00:00.000Z',
    },
    createdAt: '2026-10-30T00:00:00.000Z',
    finishedAt: '2026-10-30T00:00:05.000Z',
    errorMessage: null,
  };

  it('serves markdown report via GET /api/reports/:runId/markdown', async () => {
    const { app, database } = setupServer();
    const runsService = createRunsService(database);
    runsService.createRun(sampleRun);

    const res = await app.inject({
      method: 'GET',
      url: `/api/reports/${dummyRunId}/markdown`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/markdown');
    expect(res.body).toContain('# ChaosBoard Experiment Report');
    expect(res.body).toContain(dummyRunId);
    expect(res.body).toContain('Gateway Service Topology');
  });

  it('serves structured JSON report via GET /api/reports/:runId/json', async () => {
    const { app, database } = setupServer();
    const runsService = createRunsService(database);
    runsService.createRun(sampleRun);

    const res = await app.inject({
      method: 'GET',
      url: `/api/reports/${dummyRunId}/json`,
    });

    expect(res.statusCode).toBe(200);
    const parsed = reportExportSchema.parse(res.json());
    expect(parsed.runId).toBe(dummyRunId);
    expect(parsed.status).toBe('completed');
    expect(parsed.markdown).toContain(dummyRunId);
  });

  it('serves vector diagram SVG via GET /api/reports/:runId/diagram', async () => {
    const { app, database } = setupServer();
    const runsService = createRunsService(database);
    runsService.createRun(sampleRun);

    const res = await app.inject({
      method: 'GET',
      url: `/api/reports/${dummyRunId}/diagram`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.body).toContain('<svg');
    expect(res.body).toContain('Gateway');
  });

  it('serves blueprint card with fallback diagram via GET /api/reports/:runId/card', async () => {
    const { app, database } = setupServer();
    const runsService = createRunsService(database);
    runsService.createRun(sampleRun);

    const res = await app.inject({
      method: 'GET',
      url: `/api/reports/${dummyRunId}/card`,
    });

    expect(res.statusCode).toBe(200);
    const card = blueprintCardSchema.parse(res.json());
    expect(card.runId).toBe(dummyRunId);
    expect(card.status).toBe('fallback_to_diagram');
    expect(card.label).toBe('illustrative_rendering');
    expect(card.mimeType).toBe('image/svg+xml');
  });

  it('returns 404 problem details for non-existent run', async () => {
    const { app } = setupServer();

    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/run-99999999-9999-9999-9999-999999999999/markdown',
    });

    expect(res.statusCode).toBe(404);
    const problem = res.json<{ code?: string; status?: number }>();
    expect(problem.code).toBe('report_not_found');
    expect(problem.status).toBe(404);
  });
});
