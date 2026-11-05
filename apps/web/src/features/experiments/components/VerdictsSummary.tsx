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
      <Card title="Resilience Invariant Verdicts" className="verdicts-card">
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

      {/* Vertical Formatted Invariant Verdict Cards */}
      <div className="verdicts-vertical-list">
        {verdicts.map((v: InvariantVerdict) => {
          const faultedMetric = getMetricAggregate(faultedAgg, v.evidence.metric);
          const baselineMetric = getMetricAggregate(baselineAgg, v.evidence.metric);
          const isPass = v.status === 'PASS';
          const isViolated = v.status === 'VIOLATED';

          return (
            <div
              key={v.invariantId}
              className={`verdict-item-card ${isPass ? 'is-pass' : isViolated ? 'is-violated' : 'is-invalid'}`}
            >
              {/* Header: ID + Metric Badge + Status */}
              <div className="verdict-item-header">
                <div className="verdict-item-identity">
                  <span className="verdict-id-badge cell-mono">{v.invariantId}</span>
                  <span className="verdict-metric-badge cell-mono">{v.evidence.metric}</span>
                </div>
                <StatusPill status={v.status} />
              </div>

              {/* Threshold Requirement */}
              <div className="verdict-target-row">
                <span className="verdict-field-label">Threshold</span>
                <span className="verdict-target-val cell-mono">
                  {v.evidence.comparator ? `${v.evidence.comparator} ` : ''}
                  {String(v.evidence.threshold)}
                </span>
              </div>

              {/* Side-by-Side Measured Comparisons */}
              <div className="verdict-comparison-grid">
                <div className={`verdict-data-box ${isViolated ? 'highlight-violated' : ''}`}>
                  <span className="verdict-box-title">Faulted (Median &plusmn; IQR)</span>
                  <span className="verdict-box-val cell-mono">
                    {faultedMetric && faultedMetric.median !== null && faultedMetric.iqr !== null
                      ? `${faultedMetric.median.toFixed(1)} (IQR ${faultedMetric.iqr.toFixed(1)})`
                      : 'N/A'}
                  </span>
                </div>

                <div className="verdict-data-box">
                  <span className="verdict-box-title">Baseline (Median &plusmn; IQR)</span>
                  <span className="verdict-box-val cell-mono">
                    {baselineMetric && baselineMetric.median !== null && baselineMetric.iqr !== null
                      ? `${baselineMetric.median.toFixed(1)} (IQR ${baselineMetric.iqr.toFixed(1)})`
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Diagnostic Reason */}
              <div className="verdict-reason-banner">
                <span className="verdict-reason-prefix">Reason:</span>
                <span className="verdict-reason-text">{v.reason ?? 'Threshold check verified'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
