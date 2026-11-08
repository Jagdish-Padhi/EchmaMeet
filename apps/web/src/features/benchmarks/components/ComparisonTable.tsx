import { useState } from 'react';
import type { BenchmarkComparison } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';

export interface ComparisonTableProps {
  readonly results: readonly BenchmarkComparison[];
}

export function ComparisonTable({ results }: ComparisonTableProps) {
  const [viewMode, setViewMode] = useState<'vertical' | 'table'>('vertical');

  return (
    <Card
      title="Static LLM Baseline vs Empirical Sandbox Execution"
      actions={
        results.length > 0 ? (
          <div className="layout-toggle-group" role="group" aria-label="Layout view mode">
            <button
              type="button"
              className={`layout-toggle-btn ${viewMode === 'vertical' ? 'active' : ''}`}
              onClick={() => setViewMode('vertical')}
              title="Vertical card layout"
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
              title="Table layout"
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
        ) : undefined
      }
    >
      {viewMode === 'vertical' ? (
        <div className="benchmarks-vertical-list">
          {results.map((r) => {
            if (!r.agreement || !r.empiricalRun) {
              return (
                <div key={r.scenarioId} className="benchmark-vertical-card">
                  <div className="benchmark-card-header">
                    <span className="cell-mono benchmark-id-text">{r.scenarioId}</span>
                    <span className="bench-pred-badge">Prediction Only</span>
                  </div>
                  <p className="state-message" style={{ margin: '8px 0 0', fontSize: '12px' }}>
                    Prediction only: no measured empirical run yet.
                  </p>
                </div>
              );
            }
            const agreementPct = Math.round(r.agreement.violationAccuracy * 100);
            const predP99 = r.staticPredictions[0]?.predictedMetrics.p99LatencyMs;
            const measP99 = r.empiricalRun.p99LatencyMs;
            const ratio = r.agreement.p99Ratio;

            return (
              <div key={r.scenarioId} className="benchmark-vertical-card">
                <div className="benchmark-card-header">
                  <span className="cell-mono benchmark-id-text">{r.scenarioId}</span>
                  <StatusPill status={r.empiricalRun.overallStatus} />
                </div>
                <div className="benchmark-card-grid">
                  <div className="benchmark-card-field">
                    <span className="bench-field-label">Static Agreement</span>
                    <span className="bench-field-val cell-mono">{String(agreementPct)}%</span>
                  </div>
                  <div className="benchmark-card-field">
                    <span className="bench-field-label">Predicted p99</span>
                    <span className="bench-field-val cell-mono">
                      {predP99 !== undefined && predP99 !== null ? `${String(predP99)}ms` : 'N/A'}
                    </span>
                  </div>
                  <div className="benchmark-card-field">
                    <span className="bench-field-label">Measured p99</span>
                    <span className="bench-field-val cell-mono">
                      {measP99 !== null ? `${String(measP99)}ms` : 'N/A'}
                    </span>
                  </div>
                  <div className="benchmark-card-field">
                    <span className="bench-field-label">p99 Ratio</span>
                    <span className="bench-field-val cell-mono">
                      {ratio !== null ? `${String(ratio)}x` : 'N/A'}
                    </span>
                  </div>
                  <div className="benchmark-card-field full-width">
                    <span className="bench-field-label">Failure Mode Match</span>
                    <span
                      className={`bench-match-tag ${r.agreement.failureModeMatched ? 'is-match' : 'is-mismatch'}`}
                    >
                      {r.agreement.failureModeMatched ? 'MATCH' : 'MISMATCH'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Empirical Verdict</th>
                <th>Static Agreement</th>
                <th>Predicted p99</th>
                <th>Measured p99</th>
                <th>p99 Ratio</th>
                <th>Failure Mode Match</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                if (!r.agreement || !r.empiricalRun) {
                  return (
                    <tr key={r.scenarioId}>
                      <td className="cell-mono">{r.scenarioId}</td>
                      <td colSpan={6}>Prediction only: no measured run yet</td>
                    </tr>
                  );
                }
                const agreementPct = Math.round(r.agreement.violationAccuracy * 100);
                const predP99 = r.staticPredictions[0]?.predictedMetrics.p99LatencyMs;
                const measP99 = r.empiricalRun.p99LatencyMs;
                const ratio = r.agreement.p99Ratio;

                return (
                  <tr key={r.scenarioId}>
                    <td className="cell-mono">{r.scenarioId}</td>
                    <td>
                      <StatusPill status={r.empiricalRun.overallStatus} />
                    </td>
                    <td className="cell-mono">{String(agreementPct)}%</td>
                    <td className="cell-mono">
                      {predP99 !== undefined && predP99 !== null ? `${String(predP99)}ms` : 'N/A'}
                    </td>
                    <td className="cell-mono">{measP99 !== null ? `${String(measP99)}ms` : 'N/A'}</td>
                    <td className="cell-mono">{ratio !== null ? `${String(ratio)}x` : 'N/A'}</td>
                    <td className="cell-mono">
                      {r.agreement.failureModeMatched ? 'MATCH' : 'MISMATCH'}
                    </td>
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
