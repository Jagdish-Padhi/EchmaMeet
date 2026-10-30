import { afterEach, describe, expect, it } from 'vitest';
import {
  benchmarkSuiteSummarySchema,
  invariantIdSchema,
  runIdSchema,
  scenarioSpecSchema,
  type ScenarioSpec,
} from '@chaosboard/contracts';
import { buildApp } from '../src/app';
import { createBenchmarkModule } from '../src/modules/benchmarks';
import { moduleMigrations } from '../src/module-migrations';
import { IN_MEMORY, openDatabase, type SqlDatabase } from '../src/platform/db';
import { createLogger } from '../src/platform/logging';
import { runMigrations } from '../src/platform/migrations';
import { systemClock } from '../src/platform/system-clock';

const logger = createLogger({
  logLevel: 'silent',
  nodeEnv: 'test',
});

describe('Benchmark suite and API integration', () => {
  const closers: (() => Promise<void> | void)[] = [];

  afterEach(async () => {
    for (const close of closers.splice(0)) {
      await close();
    }
  });

  function setupServer(database: SqlDatabase = openDatabase(IN_MEMORY)) {
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

  it('serves scenario definitions via GET /api/scenarios and GET /api/scenarios/:id', async () => {
    const { app } = setupServer();

    // 1. GET /api/scenarios
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/scenarios',
    });
    expect(listRes.statusCode).toBe(200);
    const scenarios = listRes.json<ScenarioSpec[]>();
    expect(scenarios.length).toBe(6);

    const scenarioIds = scenarios.map((s) => s.id);
    expect(scenarioIds).toContain('retry-storm');
    expect(scenarioIds).toContain('missing-timeout-cascade');
    expect(scenarioIds).toContain('unbounded-queue');
    expect(scenarioIds).toContain('non-idempotent-retry');
    expect(scenarioIds).toContain('oversensitive-breaker');
    expect(scenarioIds).toContain('availability-tradeoff');

    // 2. GET /api/scenarios/retry-storm
    const singleRes = await app.inject({
      method: 'GET',
      url: '/api/scenarios/retry-storm',
    });
    expect(singleRes.statusCode).toBe(200);
    const retryStorm = scenarioSpecSchema.parse(singleRes.json());
    expect(retryStorm.id).toBe('retry-storm');
    expect(retryStorm.invariants.length).toBeGreaterThanOrEqual(2);
    expect(retryStorm.faults.length).toBeGreaterThanOrEqual(1);

    // 3. GET unknown scenario returns 404
    const unknownRes = await app.inject({
      method: 'GET',
      url: '/api/scenarios/unknown-scenario',
    });
    expect(unknownRes.statusCode).toBe(404);
  });

  it('runs benchmark runner with scripted predictor and generates truthful report', async () => {
    const benchmarks = createBenchmarkModule();

    // Scripted predictor for testing runner without external model API
    const scriptedPredictor = {
      predict: (scenario: ScenarioSpec, index: number) => {
        return Promise.resolve({
          scenarioId: scenario.id,
          predictionIndex: index,
          modelId: 'test-model',
          promptVersion: 'prediction-v1',
          predictedViolations: {
            'inv-p99': true,
            'inv-completion': false,
          },
          predictedMetrics: {
            p99LatencyMs: 1200,
            errorRate: 0.05,
          },
          predictedFailureMode: 'Synchronous retry storm causing worker exhaustion',
          rationale: 'Retrying under latency amplifies concurrency.',
          timestamp: new Date().toISOString(),
        });
      },
    };

    // Scripted experiment runner
    const scriptedExperimentRunner = {
      runExperiment: (scenario: ScenarioSpec) => {
        return Promise.resolve({
          runId: runIdSchema.parse(
            `run-12345678-abcd-1234-abcd-${scenario.id.slice(0, 8).padEnd(12, '0')}`,
          ),
          verdicts: [
            {
              invariantId: invariantIdSchema.parse('inv-p99'),
              status: 'VIOLATED' as const,
              reason: 'Measured p99 exceeds threshold',
              evidence: {
                metric: 'e2e_p99_ms' as const,
                scope: { kind: 'system' as const },
                comparator: 'lte' as const,
                threshold: 500,
                baselineAggregate: { median: 100, p25: 90, p75: 110, iqr: 20 },
                faultedAggregate: { median: 1000, p25: 950, p75: 1050, iqr: 100 },
                baselineValues: [100],
                faultedValues: [1000],
              },
            },
            {
              invariantId: invariantIdSchema.parse('inv-completion'),
              status: 'PASS' as const,
              reason: null,
              evidence: {
                metric: 'completion_rate' as const,
                scope: { kind: 'system' as const },
                comparator: 'gte' as const,
                threshold: 0.95,
                baselineAggregate: { median: 1.0, p25: 1.0, p75: 1.0, iqr: 0 },
                faultedAggregate: { median: 0.98, p25: 0.97, p75: 0.99, iqr: 0.02 },
                baselineValues: [1.0],
                faultedValues: [0.98],
              },
            },
          ],
          overallStatus: 'VIOLATED' as const,
          p99LatencyMs: 1000,
          errorRate: 0.02,
        });
      },
    };

    const scriptedRepairRunner = {
      runRepair: () => {
        return Promise.resolve({
          status: 'repaired' as const,
          iterationsCount: 2,
          patchCount: 2,
          totalTokens: {
            promptTokens: 400,
            completionTokens: 80,
          },
        });
      },
    };

    const runner = new (await import('../src/modules/benchmarks')).BenchmarkRunner({
      scenarios: benchmarks.storage,
      persistence: benchmarks.storage,
      predictor: scriptedPredictor,
      experimentRunner: scriptedExperimentRunner,
      repairRunner: scriptedRepairRunner,
    });

    const summary = await runner.runSuite({
      scenarioFilter: 'retry-storm',
      predictionsPerScenario: 1,
      gitCommit: 'test-commit',
      hostDescription: 'test-environment',
      nodeVersion: 'v22.14.0',
    });

    expect(summary.results.length).toBe(1);
    expect(summary.results[0]?.scenarioId).toBe('retry-storm');
    expect(summary.results[0]?.agreement.violationAccuracy).toBe(1.0);
    expect(summary.results[0]?.agreement.failureModeMatched).toBe(true);
    expect(summary.aggregateMetrics.staticAccuracyPct).toBe(100);

    // Verify GET /api/benchmarks/results returns the stored summary
    const { app } = setupServer();
    const resultsRes = await app.inject({
      method: 'GET',
      url: '/api/benchmarks/results',
    });
    expect(resultsRes.statusCode).toBe(200);
    const retrieved = benchmarkSuiteSummarySchema.parse(resultsRes.json());
    expect(retrieved.results.length).toBe(1);
    expect(retrieved.gitCommit).toBe('test-commit');
  });
});
