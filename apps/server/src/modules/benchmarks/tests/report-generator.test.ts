import { describe, it, expect } from 'vitest';
import {
  invariantIdSchema,
  runIdSchema,
  scenarioIdSchema,
  type BenchmarkSuiteSummary,
} from '@chaosboard/contracts';
import { generateBenchmarkReport } from '../domain/report-generator';

describe('benchmarks report generator', () => {
  const scenarioId = scenarioIdSchema.parse('retry-storm');
  const runId = runIdSchema.parse('run-12345678-abcd-1234-abcd-1234567890ab');
  const invariantId = invariantIdSchema.parse('inv-p99');

  const summary: BenchmarkSuiteSummary = {
    schemaVersion: 1,
    generatedAt: '2026-10-30T12:00:00.000Z',
    gitCommit: '7f280bb',
    hostDescription: 'win32 (Intel i7, 12 cores)',
    nodeVersion: 'v22.14.0',
    results: [
      {
        scenarioId,
        designedFailureMode: 'Synchronous retry storm causing worker exhaustion downstream',
        staticPredictions: [
          {
            scenarioId,
            predictionIndex: 0,
            modelId: 'meta-models/muse-spark-open-1026',
            promptVersion: 'prediction-v1',
            predictedViolations: { 'inv-p99': true },
            predictedMetrics: { p99LatencyMs: 1500, errorRate: 0.05 },
            predictedFailureMode: 'Retry amplification under latency',
            rationale: 'Retries without backoff exhaust concurrency pool',
            timestamp: '2026-10-30T10:00:00.000Z',
          },
        ],
        empiricalRun: {
          runId,
          verdicts: [
            {
              invariantId,
              status: 'VIOLATED',
              reason: 'Measured p99 exceeds 500ms',
              evidence: {
                metric: 'e2e_p99_ms',
                scope: { kind: 'system' },
                comparator: 'lte',
                threshold: 500,
                baselineAggregate: { median: 100, p25: 90, p75: 110, iqr: 20 },
                faultedAggregate: { median: 1200, p25: 1150, p75: 1250, iqr: 100 },
                baselineValues: [100],
                faultedValues: [1200],
              },
            },
          ],
          overallStatus: 'VIOLATED',
          p99LatencyMs: 1200,
          errorRate: 0.02,
        },
        repairComparisons: {
          model: {
            status: 'repaired',
            iterationsCount: 1,
            patchCount: 1,
            totalTokens: { promptTokens: 350, completionTokens: 60 },
          },
          ruleBased: {
            status: 'repaired',
            iterationsCount: 2,
            patchCount: 2,
          },
        },
        agreement: {
          violationAccuracy: 1.0,
          p99Ratio: 1.25,
          errorRateDelta: 0.03,
          failureModeMatched: true,
        },
      },
    ],
    aggregateMetrics: {
      staticAccuracyPct: 100,
      modelRepairSuccessPct: 100,
      ruleBasedRepairSuccessPct: 100,
      unpredictedFailuresCount: 0,
    },
  };

  it('generates a truthful markdown document with all tables and metadata', () => {
    const markdown = generateBenchmarkReport(summary);

    expect(markdown).toContain('# Benchmark Suite Results');
    expect(markdown).toContain('`7f280bb`');
    expect(markdown).toContain('win32 (Intel i7, 12 cores)');
    expect(markdown).toContain('`retry-storm`');
    expect(markdown).toContain('1200 ms');
    expect(markdown).toContain('1.25x');
    expect(markdown).toContain('repaired');
    expect(markdown).toContain('## Surprises and Unexpected Outcomes');
    expect(markdown).toContain('## Honest Limitations');
  });
});
