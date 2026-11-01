import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { invariantIdSchema, type InvariantVerdict, type RunRecord } from '@chaosboard/contracts';
import { VerdictsSummary } from '../components/VerdictsSummary';

describe('VerdictsSummary component', () => {
  it('renders waiting state when verdicts are null', () => {
    const html = renderToStaticMarkup(
      <VerdictsSummary verdicts={null} overallStatus={null} finalRecord={null} />,
    );
    expect(html).toContain('Verdicts evaluate automatically once all simulation trials complete.');
  });

  it('renders all invariant verdicts with medians, thresholds, and reasons', () => {
    const fixtureVerdicts = [
      {
        invariantId: invariantIdSchema.parse('inv-p99'),
        status: 'VIOLATED',
        reason: 'Measured p99 exceeds 500ms threshold under retry storm',
        evidence: {
          metric: 'e2e_p99_ms',
          comparator: 'lte',
          threshold: 500,
          sampleCount: 3,
          baselineMedian: 120.0,
          faultedMedian: 1250.5,
          margin: 750.5,
          faultedValues: [1200, 1250, 1300],
        },
      },
      {
        invariantId: invariantIdSchema.parse('inv-completion'),
        status: 'PASS',
        reason: null,
        evidence: {
          metric: 'completion_rate',
          comparator: 'gte',
          threshold: 0.95,
          sampleCount: 3,
          baselineMedian: 1.0,
          faultedMedian: 0.98,
          margin: 0.03,
          faultedValues: [0.98, 0.98, 0.99],
        },
      },
    ] as unknown as readonly InvariantVerdict[];

    const fixtureRecord = {
      baselineAggregate: {
        metrics: {
          p99LatencyMs: { median: 120.0, iqr: 10.0, p25: 115.0, p75: 125.0 },
          completionRate: { median: 1.0, iqr: 0.0, p25: 1.0, p75: 1.0 },
        },
      },
      faultedAggregate: {
        metrics: {
          p99LatencyMs: { median: 1250.5, iqr: 80.2, p25: 1210.0, p75: 1290.2 },
          completionRate: { median: 0.98, iqr: 0.01, p25: 0.975, p75: 0.985 },
        },
      },
    } as unknown as RunRecord;

    const html = renderToStaticMarkup(
      <VerdictsSummary
        verdicts={fixtureVerdicts}
        overallStatus="VIOLATED"
        finalRecord={fixtureRecord}
      />,
    );

    expect(html).toContain('VIOLATED');
    expect(html).toContain('PASS');
    expect(html).toContain('inv-p99');
    expect(html).toContain('inv-completion');
    expect(html).toContain('1250.5 (IQR 80.2)');
    expect(html).toContain('120.0 (IQR 10.0)');
    expect(html).toContain('Measured p99 exceeds 500ms threshold under retry storm');
  });
});
