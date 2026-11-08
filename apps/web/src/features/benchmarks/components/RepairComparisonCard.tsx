import { useState } from 'react';
import type { BenchmarkComparison } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';

export interface RepairComparisonCardProps {
  readonly results: readonly BenchmarkComparison[];
}

export function RepairComparisonCard({ results }: RepairComparisonCardProps) {
  const [viewMode, setViewMode] = useState<'vertical' | 'table'>('vertical');
  const validResults = results.filter((r) => Boolean(r.repairComparisons));

  return (
    <Card
      title="Repair Loop Comparison: Model Agent vs Rule-Based Baseline"
      actions={
        validResults.length > 0 ? (
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
      ) : (
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
      )}
    </Card>
  );
}
