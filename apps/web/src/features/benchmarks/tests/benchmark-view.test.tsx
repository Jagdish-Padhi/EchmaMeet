import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { runIdSchema, type BenchmarkSuiteSummary, type ScenarioId } from '@chaosboard/contracts';
import { ComparisonTable } from '../components/ComparisonTable';
import { ExecutiveSummaryCard } from '../components/ExecutiveSummaryCard';

describe('Benchmark Components', () => {
  const fixtureSummary: BenchmarkSuiteSummary = {
    schemaVersion: 1,
    generatedAt: '2026-10-30T10:00:00.000Z',
    gitCommit: 'abc1234',
    hostDescription: 'x86_64-test',
    nodeVersion: 'v22.14.0',
    results: [
      {
        scenarioId: 'retry-storm' as ScenarioId,
        designedFailureMode: 'Synchronous retry storm causing worker exhaustion downstream',
        staticPredictions: [
          {
            scenarioId: 'retry-storm' as ScenarioId,
            predictionIndex: 0,
            modelId: 'meta-models/muse-spark-open-1026',
            promptVersion: 'prediction-v1',
            predictedViolations: { 'inv-p99': true },
            predictedMetrics: { p99LatencyMs: 1500, errorRate: 0.1 },
            predictedFailureMode: 'Retry storm',
            rationale: 'Retries amplify queue load',
            timestamp: '2026-10-30T10:00:00.000Z',
          },
        ],
        empiricalRun: {
          runId: runIdSchema.parse('run-12345678-abcd-1234-abcd-1234567890ab'),
          verdicts: [],
          overallStatus: 'VIOLATED',
          p99LatencyMs: 1000,
          errorRate: 0.05,
        },
        agreement: {
          violationAccuracy: 1.0,
          p99Ratio: 1.5,
          errorRateDelta: 0.05,
          failureModeMatched: true,
        },
        repairComparisons: {
          model: {
            status: 'repaired',
            iterationsCount: 2,
            patchCount: 2,
            totalTokens: { promptTokens: 300, completionTokens: 180 },
          },
          ruleBased: {
            status: 'repaired',
            iterationsCount: 2,
            patchCount: 2,
          },
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

  it('renders executive summary numbers accurately without alteration', () => {
    const html = renderToStaticMarkup(<ExecutiveSummaryCard summary={fixtureSummary} />);
    expect(html).toContain('100%');
    expect(html).toContain('abc1234');
    expect(html).toContain('x86_64-test');
    expect(html).toContain('v22.14.0');
  });

  it('renders comparison table with empirical verdict and measured values', () => {
    const html = renderToStaticMarkup(<ComparisonTable results={fixtureSummary.results} />);
    expect(html).toContain('retry-storm');
    expect(html).toContain('VIOLATED');
    expect(html).toContain('1500ms');
    expect(html).toContain('1000ms');
    expect(html).toContain('1.5x');
    expect(html).toContain('MATCH');
  });
});
