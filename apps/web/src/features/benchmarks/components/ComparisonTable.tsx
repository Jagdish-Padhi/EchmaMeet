import type { BenchmarkComparison } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';

export interface ComparisonTableProps {
  readonly results: readonly BenchmarkComparison[];
}

export function ComparisonTable({ results }: ComparisonTableProps) {
  return (
    <Card title="Model vs Sandbox Execution">
      <div className="benchmarks-vertical-list">
          {results.map((r) => {
            if (!r.agreement || !r.empiricalRun) {
              const pred = r.staticPredictions[0];
              const predP99 = pred?.predictedMetrics?.p99LatencyMs;
              const predErr = pred?.predictedMetrics?.errorRate;

              return (
                <div key={r.scenarioId} className="benchmark-vertical-card">
                  <div className="benchmark-card-header">
                    <span className="cell-mono benchmark-id-text">{r.scenarioId}</span>
                    <span className="bench-pred-badge">Model Prediction</span>
                  </div>
                  <div className="benchmark-card-grid">
                    <div className="benchmark-card-field">
                      <span className="bench-field-label">Predicted p99</span>
                      <span className="bench-field-val cell-mono">
                        {predP99 !== undefined && predP99 !== null ? `${String(predP99)}ms` : '—'}
                      </span>
                    </div>
                    <div className="benchmark-card-field">
                      <span className="bench-field-label">Predicted Error Rate</span>
                      <span className="bench-field-val cell-mono">
                        {predErr !== undefined && predErr !== null
                          ? `${String(Math.round(predErr * 100))}%`
                          : '—'}
                      </span>
                    </div>
                    <div className="benchmark-card-field full-width">
                      <span className="bench-field-label">Empirical Status</span>
                      <span className="bench-field-val" style={{ color: 'var(--color-text-dim)' }}>
                        Awaiting Simulation Run
                      </span>
                    </div>
                  </div>
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
    </Card>
  );
}
