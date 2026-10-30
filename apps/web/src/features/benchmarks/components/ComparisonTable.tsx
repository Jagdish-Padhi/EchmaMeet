import type { BenchmarkComparison } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';

export interface ComparisonTableProps {
  readonly results: readonly BenchmarkComparison[];
}

export function ComparisonTable({ results }: ComparisonTableProps) {
  return (
    <Card title="Static LLM Baseline vs Empirical Sandbox Execution">
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
    </Card>
  );
}
