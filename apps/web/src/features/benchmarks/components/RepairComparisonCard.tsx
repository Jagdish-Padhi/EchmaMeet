import type { BenchmarkComparison } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';

export interface RepairComparisonCardProps {
  readonly results: readonly BenchmarkComparison[];
}

export function RepairComparisonCard({ results }: RepairComparisonCardProps) {
  return (
    <Card title="Repair Loop: Model vs Rule Baseline">
      <div className="benchmarks-vertical-list">
          {results.map((r) => {
            const rep = r.repairComparisons;
            if (!rep) return null;

            const totalTokens = rep.model?.totalTokens
              ? rep.model.totalTokens.promptTokens + rep.model.totalTokens.completionTokens
              : undefined;

            return (
              <div key={r.scenarioId} className="benchmark-vertical-card">
                <div className="benchmark-card-header">
                  <span className="cell-mono benchmark-id-text">{r.scenarioId}</span>
                  <span className="bench-pred-badge">Repair Comparison</span>
                </div>
                <div className="benchmark-card-grid">
                  <div className="benchmark-card-field">
                    <span className="bench-field-label">Model Status</span>
                    <span className="bench-field-val cell-mono">{rep.model?.status ?? 'N/A'}</span>
                  </div>
                  <div className="benchmark-card-field">
                    <span className="bench-field-label">Model Iterations</span>
                    <span className="bench-field-val cell-mono">
                      {rep.model?.iterationsCount !== undefined
                        ? String(rep.model.iterationsCount)
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="benchmark-card-field">
                    <span className="bench-field-label">Rule Status</span>
                    <span className="bench-field-val cell-mono">{rep.ruleBased?.status ?? 'N/A'}</span>
                  </div>
                  <div className="benchmark-card-field">
                    <span className="bench-field-label">Rule Iterations</span>
                    <span className="bench-field-val cell-mono">
                      {rep.ruleBased?.iterationsCount !== undefined
                        ? String(rep.ruleBased.iterationsCount)
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="benchmark-card-field full-width">
                    <span className="bench-field-label">Tokens Consumed</span>
                    <span className="bench-field-val cell-mono">
                      {totalTokens !== undefined ? String(totalTokens) : 'N/A'}
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
