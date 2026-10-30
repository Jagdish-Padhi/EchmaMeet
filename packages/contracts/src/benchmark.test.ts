import { describe, it, expect } from 'vitest';
import {
  staticPredictionSchema,
  benchmarkComparisonSchema,
  benchmarkSuiteSummarySchema,
} from './benchmark';
import { invariantIdSchema, runIdSchema, scenarioIdSchema } from './ids';

describe('benchmark contracts', () => {
  const scenarioId = scenarioIdSchema.parse('retry-storm');
  const runId = runIdSchema.parse('run-12345678-abcd-1234-abcd-1234567890ab');
  const invariantId = invariantIdSchema.parse('inv-p99');

  const validStaticPrediction = {
    scenarioId,
    predictionIndex: 0,
    modelId: 'meta-models/muse-spark-open-1026',
    promptVersion: 'prediction-v1',
    predictedViolations: {
      'inv-p99': true,
      'inv-error-rate': false,
    },
    predictedMetrics: {
      p99LatencyMs: 1500,
      errorRate: 0.05,
    },
    predictedFailureMode: 'Synchronous retry storm causing worker exhaustion downstream',
    rationale: 'Retrying under latency amplifies concurrency and pins workers.',
    timestamp: '2026-10-30T10:00:00.000Z',
  };

  const validComparison = {
    scenarioId,
    designedFailureMode: 'Synchronous retry storm causing worker exhaustion downstream',
    staticPredictions: [validStaticPrediction],
    empiricalRun: {
      runId,
      verdicts: [
        {
          invariantId,
          status: 'VIOLATED' as const,
          reason: 'Measured p99 exceeds 500ms',
          evidence: {
            metric: 'e2e_p99_ms' as const,
            scope: { kind: 'system' as const },
            comparator: 'lte' as const,
            threshold: 500,
            baselineAggregate: { median: 100, p25: 95, p75: 105, iqr: 10 },
            faultedAggregate: { median: 1200, p25: 1150, p75: 1250, iqr: 100 },
            baselineValues: [95, 100, 105],
            faultedValues: [1150, 1200, 1250],
          },
        },
      ],
      overallStatus: 'VIOLATED' as const,
      p99LatencyMs: 1200,
      errorRate: 0.02,
    },
    repairComparisons: {
      ruleBased: {
        status: 'repaired' as const,
        iterationsCount: 2,
        patchCount: 2,
      },
      model: {
        status: 'repaired' as const,
        iterationsCount: 1,
        patchCount: 1,
        totalTokens: {
          promptTokens: 400,
          completionTokens: 80,
        },
      },
    },
    agreement: {
      violationAccuracy: 1.0,
      p99Ratio: 1.25,
      errorRateDelta: 0.03,
      failureModeMatched: true,
    },
  };

  it('parses valid static prediction', () => {
    const parsed = staticPredictionSchema.parse(validStaticPrediction);
    expect(parsed.scenarioId).toBe(scenarioId);
    expect(parsed.predictedViolations['inv-p99']).toBe(true);
  });

  it('parses valid benchmark comparison', () => {
    const parsed = benchmarkComparisonSchema.parse(validComparison);
    expect(parsed.scenarioId).toBe(scenarioId);
    expect(parsed.agreement.failureModeMatched).toBe(true);
  });

  it('parses valid benchmark suite summary', () => {
    const suite = {
      schemaVersion: 1,
      generatedAt: '2026-10-30T11:00:00.000Z',
      gitCommit: 'abcdef1234567890',
      hostDescription: 'Windows test host',
      nodeVersion: 'v22.14.0',
      results: [validComparison],
      aggregateMetrics: {
        staticAccuracyPct: 83.3,
        modelRepairSuccessPct: 100,
        ruleBasedRepairSuccessPct: 100,
        unpredictedFailuresCount: 0,
      },
    };
    const parsed = benchmarkSuiteSummarySchema.parse(suite);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.results.length).toBe(1);
  });
});
