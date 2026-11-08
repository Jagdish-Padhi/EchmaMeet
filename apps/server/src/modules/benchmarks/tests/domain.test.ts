import { describe, it, expect } from 'vitest';
import {
  invariantIdSchema,
  runIdSchema,
  scenarioIdSchema,
  type BenchmarkComparison,
  type StaticPrediction,
} from '@chaosboard/contracts';
import { calculateAgreement, computeSuiteSummary } from '../domain/metrics';

describe('benchmarks domain metrics', () => {
  const scenarioId = scenarioIdSchema.parse('retry-storm');
  const runId = runIdSchema.parse('run-12345678-abcd-1234-abcd-1234567890ab');
  const invP99 = invariantIdSchema.parse('inv-p99');
  const invComp = invariantIdSchema.parse('inv-comp');

  const predictions: StaticPrediction[] = [
    {
      scenarioId,
      predictionIndex: 0,
      modelId: 'gnani-evon-v3.3',
      promptVersion: 'prediction-v1',
      predictedViolations: {
        'inv-p99': true,
        'inv-comp': false,
      },
      predictedMetrics: {
        p99LatencyMs: 1500,
        errorRate: 0.05,
      },
      predictedFailureMode: 'Synchronous retry storm causing worker exhaustion',
      rationale: 'Retrying under latency amplifies concurrency.',
      timestamp: '2026-10-30T10:00:00.000Z',
    },
  ];

  const empiricalRun: BenchmarkComparison['empiricalRun'] = {
    runId,
    verdicts: [
      {
        invariantId: invP99,
        status: 'VIOLATED',
        reason: 'p99 too high',
        evidence: {
          metric: 'e2e_p99_ms',
          scope: { kind: 'system' },
          comparator: 'lte',
          threshold: 500,
          baselineAggregate: { median: 100, p25: 90, p75: 110, iqr: 20 },
          faultedAggregate: { median: 1000, p25: 950, p75: 1050, iqr: 100 },
          baselineValues: [100],
          faultedValues: [1000],
        },
      },
      {
        invariantId: invComp,
        status: 'PASS',
        reason: null,
        evidence: {
          metric: 'completion_rate',
          scope: { kind: 'system' },
          comparator: 'gte',
          threshold: 0.95,
          baselineAggregate: { median: 1.0, p25: 1.0, p75: 1.0, iqr: 0 },
          faultedAggregate: { median: 0.98, p25: 0.97, p75: 0.99, iqr: 0.02 },
          baselineValues: [1.0],
          faultedValues: [0.98],
        },
      },
    ],
    overallStatus: 'VIOLATED',
    p99LatencyMs: 1000,
    errorRate: 0.02,
  };

  it('calculates agreement correctly when prediction matches empirical run', () => {
    const agreement = calculateAgreement(
      predictions,
      empiricalRun,
      'Synchronous retry storm causing worker exhaustion downstream',
    );

    expect(agreement.violationAccuracy).toBe(1.0);
    expect(agreement.p99Ratio).toBe(1.5);
    expect(agreement.errorRateDelta).toBe(0.03);
    expect(agreement.failureModeMatched).toBe(true);
  });

  it('detects failure mode mismatch when keywords do not overlap', () => {
    const agreement = calculateAgreement(
      predictions,
      empiricalRun,
      'Completely unrelated memory leak in cache',
    );
    expect(agreement.failureModeMatched).toBe(false);
  });

  it('computes suite summary across multiple comparisons', () => {
    const comparison: BenchmarkComparison = {
      scenarioId,
      designedFailureMode: 'Synchronous retry storm',
      staticPredictions: predictions,
      empiricalRun,
      repairComparisons: {
        model: {
          status: 'repaired',
          iterationsCount: 1,
          patchCount: 1,
        },
        ruleBased: {
          status: 'repaired',
          iterationsCount: 2,
          patchCount: 2,
        },
      },
      agreement: {
        violationAccuracy: 1.0,
        p99Ratio: 1.5,
        errorRateDelta: 0.03,
        failureModeMatched: true,
      },
    };

    const summary = computeSuiteSummary([comparison], {
      generatedAt: '2026-10-30T12:00:00.000Z',
      gitCommit: '1234567',
      hostDescription: 'test-host',
      nodeVersion: 'v22.14.0',
    });

    expect(summary.aggregateMetrics.staticAccuracyPct).toBe(100);
    expect(summary.aggregateMetrics.modelRepairSuccessPct).toBe(100);
    expect(summary.aggregateMetrics.ruleBasedRepairSuccessPct).toBe(100);
    expect(summary.aggregateMetrics.unpredictedFailuresCount).toBe(0);
  });
});
