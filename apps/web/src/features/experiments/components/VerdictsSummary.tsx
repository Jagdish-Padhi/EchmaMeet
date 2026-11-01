import type {
  InvariantMetric,
  InvariantVerdict,
  MetricAggregate,
  RunRecord,
  TrialAggregate,
  VerdictStatus,
} from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';

export interface VerdictsSummaryProps {
  readonly verdicts: readonly InvariantVerdict[] | null;
  readonly overallStatus: VerdictStatus | null;
  readonly finalRecord: RunRecord | null;
}

function getMetricAggregate(
  agg: TrialAggregate | null | undefined,
  metric: InvariantMetric,
): MetricAggregate | null {
  if (!agg) return null;
  switch (metric) {
    case 'e2e_p99_ms':
      return agg.metrics.p99LatencyMs;
    case 'completion_rate':
      return agg.metrics.completionRate;
    case 'duplicate_write_rate':
      return agg.metrics.duplicateWriteRate;
    case 'e2e_error_rate':
    case 'retry_amplification':
    case 'worker_saturation':
    case 'queue_depth_max':
    case 'breaker_open_fraction':
      return null;
  }
}

export function VerdictsSummary({ verdicts, overallStatus, finalRecord }: VerdictsSummaryProps) {
  if (!verdicts) {
    return (
      <Card title="Resilience Invariant Verdicts">
        <p className="state-message">
          Verdicts evaluate automatically once all simulation trials complete.
        </p>
      </Card>
    );
  }

  const baselineAgg = finalRecord?.baselineAggregate;
  const faultedAgg = finalRecord?.faultedAggregate;

  return (
    <Card
      title="Invariant Verdicts"
      actions={<StatusPill status={overallStatus ?? 'INCONCLUSIVE'} />}
      className="verdicts-card"
    >
      <div className="verdicts-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invariant ID</th>
              <th>Status</th>
              <th>Metric</th>
              <th>Threshold</th>
              <th>Faulted (Median &plusmn; IQR)</th>
              <th>Baseline (Median &plusmn; IQR)</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {verdicts.map((v: InvariantVerdict) => {
              const faultedMetric = getMetricAggregate(faultedAgg, v.evidence.metric);
              const baselineMetric = getMetricAggregate(baselineAgg, v.evidence.metric);

              return (
                <tr key={v.invariantId} className={`verdict-row verdict-${v.status.toLowerCase()}`}>
                  <td className="cell-mono">{v.invariantId}</td>
                  <td>
                    <StatusPill status={v.status} />
                  </td>
                  <td className="cell-mono">{v.evidence.metric}</td>
                  <td className="cell-mono">{String(v.evidence.threshold)}</td>
                  <td className="cell-mono">
                    {faultedMetric && faultedMetric.median !== null && faultedMetric.iqr !== null
                      ? `${faultedMetric.median.toFixed(1)} (IQR ${faultedMetric.iqr.toFixed(1)})`
                      : 'N/A'}
                  </td>
                  <td className="cell-mono">
                    {baselineMetric && baselineMetric.median !== null && baselineMetric.iqr !== null
                      ? `${baselineMetric.median.toFixed(1)} (IQR ${baselineMetric.iqr.toFixed(1)})`
                      : 'N/A'}
                  </td>
                  <td>{v.reason ?? 'Threshold check verified'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
