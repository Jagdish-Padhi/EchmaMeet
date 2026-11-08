import { useState } from 'react';
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
  const [viewMode, setViewMode] = useState<'vertical' | 'table'>('vertical');

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
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="layout-toggle-group" role="group" aria-label="Layout view mode">
            <button
              type="button"
              className={`layout-toggle-btn ${viewMode === 'vertical' ? 'active' : ''}`}
              onClick={() => setViewMode('vertical')}
              title="Vertical card layout (drawer optimized)"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="7" rx="2" />
                <rect x="3" y="14" width="18" height="7" rx="2" />
              </svg>
              <span>Vertical</span>
            </button>
            <button
              type="button"
              className={`layout-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table spreadsheet layout"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
              </svg>
              <span>Table</span>
            </button>
          </div>
          <StatusPill status={overallStatus ?? 'INCONCLUSIVE'} />
        </div>
      }
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

      {viewMode === 'vertical' ? (
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
                  <p className="verdict-reason-text">{v.reason ?? 'Threshold check verified'}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="verdicts-table-wrapper">
          <table className="data-table verdicts-data-table">
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
                    <td className="cell-mono verdict-id-cell">{v.invariantId}</td>
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
                    <td className="verdict-reason-cell">{v.reason ?? 'Threshold check verified'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
