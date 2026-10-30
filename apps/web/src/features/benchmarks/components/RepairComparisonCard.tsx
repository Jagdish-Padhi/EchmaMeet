import type { BenchmarkComparison } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';

export interface RepairComparisonCardProps {
  readonly results: readonly BenchmarkComparison[];
}

export function RepairComparisonCard({ results }: RepairComparisonCardProps) {
  return (
    <Card title="Repair Loop Comparison: Model Agent vs Rule-Based Baseline">
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Model Status</th>
              <th>Model Iterations</th>
              <th>Rule Status</th>
              <th>Rule Iterations</th>
              <th>Tokens Used</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const rep = r.repairComparisons;
              if (!rep) return null;

              const totalTokens = rep.model?.totalTokens
                ? rep.model.totalTokens.promptTokens + rep.model.totalTokens.completionTokens
                : undefined;

              return (
                <tr key={r.scenarioId}>
                  <td className="cell-mono">{r.scenarioId}</td>
                  <td className="cell-mono">{rep.model?.status ?? 'N/A'}</td>
                  <td className="cell-mono">
                    {rep.model?.iterationsCount !== undefined
                      ? String(rep.model.iterationsCount)
                      : 'N/A'}
                  </td>
                  <td className="cell-mono">{rep.ruleBased?.status ?? 'N/A'}</td>
                  <td className="cell-mono">
                    {rep.ruleBased?.iterationsCount !== undefined
                      ? String(rep.ruleBased.iterationsCount)
                      : 'N/A'}
                  </td>
                  <td className="cell-mono">
                    {totalTokens !== undefined ? String(totalTokens) : 'N/A'}
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
