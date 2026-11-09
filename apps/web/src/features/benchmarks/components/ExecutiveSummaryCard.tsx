import type { BenchmarkSuiteSummary } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';

export interface ExecutiveSummaryCardProps {
  readonly summary: BenchmarkSuiteSummary;
  readonly hideTitle?: boolean;
}

export function ExecutiveSummaryCard({ summary, hideTitle = false }: ExecutiveSummaryCardProps) {
  const metrics = summary.aggregateMetrics;

  return (
    <Card
      title={hideTitle ? undefined : 'Benchmark Summary'}
      className="benchmark-summary-card"
    >
      <div className="summary-grid">
        <div className="summary-metric-box">
          <span className="summary-label">Evaluated Scenarios</span>
          <span className="summary-value cell-mono">{String(summary.results.length)}</span>
        </div>
        <div className="summary-metric-box">
          <span className="summary-label">Static Prediction Agreement</span>
          <span className="summary-value cell-mono">{String(metrics.staticAccuracyPct)}%</span>
        </div>
        <div className="summary-metric-box">
          <span className="summary-label">Model Repair Success</span>
          <span className="summary-value cell-mono">{String(metrics.modelRepairSuccessPct)}%</span>
        </div>
        <div className="summary-metric-box">
          <span className="summary-label">Rule Repair Success</span>
          <span className="summary-value cell-mono">
            {String(metrics.ruleBasedRepairSuccessPct)}%
          </span>
        </div>
        <div className="summary-metric-box">
          <span className="summary-label">Unpredicted Failures</span>
          <span className="summary-value cell-mono">
            {String(metrics.unpredictedFailuresCount)}
          </span>
        </div>
      </div>
      <div className="meta-footer">
        <span className="meta-pill">
          <span className="meta-pill-label">Commit</span>
          <span className="cell-mono">{summary.gitCommit}</span>
        </span>
        <span className="meta-pill">
          <span className="meta-pill-label">Host</span>
          <span>{summary.hostDescription}</span>
        </span>
        <span className="meta-pill">
          <span className="meta-pill-label">Node</span>
          <span className="cell-mono">{summary.nodeVersion}</span>
        </span>
      </div>
    </Card>
  );
}
