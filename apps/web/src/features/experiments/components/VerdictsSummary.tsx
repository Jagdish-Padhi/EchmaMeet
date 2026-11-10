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
import { formatEmpiricalFinding } from '../utils/verdictFormatters';

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
      <Card title="Invariant Verdicts" className="verdicts-card">
        <p className="state-message">
          Verdicts evaluate automatically once all simulation trials complete.
        </p>
      </Card>
    );
  }

  const baselineAgg = finalRecord?.baselineAggregate;
  const faultedAgg = finalRecord?.faultedAggregate;

  const passedCount = verdicts.filter((v) => v.status === 'PASS').length;
  const violatedCount = verdicts.filter((v) => v.status === 'VIOLATED').length;

  return (
    <Card
      title="Invariant Verdicts"
      actions={<StatusPill status={overallStatus ?? 'INCONCLUSIVE'} />}
      className="verdicts-card"
    >
      {/* Verdict Summary Strip */}
      <div className="verdict-summary-banner">
        <span className={`summary-status-pill ${overallStatus === 'PASS' ? 'pass' : 'violated'}`}>
          {overallStatus === 'PASS'
            ? 'All Invariants Satisfied'
            : `${String(violatedCount)} Invariant(s) Violated`}
        </span>
        <span className="summary-counts">
          {String(passedCount)} Passed · {String(violatedCount)} Violated
        </span>
      </div>

      <div className="verdicts-vertical-list">
          {verdicts.map((v: InvariantVerdict) => {
            const faultedMetric = getMetricAggregate(faultedAgg, v.evidence.metric);
            const baselineMetric = getMetricAggregate(baselineAgg, v.evidence.metric);

            return (
              <div
                key={v.invariantId}
                className={`verdict-vertical-card verdict-${v.status.toLowerCase()}`}
              >
                <div className="verdict-card-header">
                  <div className="verdict-card-id-group">
                    <span className="verdict-indicator-dot" />
                    <span className="cell-mono verdict-id-cell">{v.invariantId}</span>
                  </div>
                  <StatusPill status={v.status} />
                </div>

                <div className="verdict-card-grid">
                  <div className="verdict-card-field">
                    <span className="verdict-field-label">Metric</span>
                    <span className="verdict-field-value cell-mono">{v.evidence.metric}</span>
                  </div>
                  <div className="verdict-card-field">
                    <span className="verdict-field-label">Threshold</span>
                    <span className="verdict-field-value cell-mono">{String(v.evidence.threshold)}</span>
                  </div>
                  <div className="verdict-card-field">
                    <span className="verdict-field-label">Faulted (Median &plusmn; IQR)</span>
                    <span className="verdict-field-value cell-mono">
                      {faultedMetric && faultedMetric.median !== null && faultedMetric.iqr !== null
                        ? `${faultedMetric.median.toFixed(1)} (IQR ${faultedMetric.iqr.toFixed(1)})`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="verdict-card-field">
                    <span className="verdict-field-label">Baseline (Median &plusmn; IQR)</span>
                    <span className="verdict-field-value cell-mono">
                      {baselineMetric && baselineMetric.median !== null && baselineMetric.iqr !== null
                        ? `${baselineMetric.median.toFixed(1)} (IQR ${baselineMetric.iqr.toFixed(1)})`
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="verdict-card-reason">
                  <span className="verdict-field-label">Empirical Finding</span>
                  <p className="verdict-reason-text">{formatEmpiricalFinding(v)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }
