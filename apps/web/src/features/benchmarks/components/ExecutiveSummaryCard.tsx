import type { BenchmarkSuiteSummary } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';

export interface ExecutiveSummaryCardProps {
  readonly summary: BenchmarkSuiteSummary;
}

export function ExecutiveSummaryCard({ summary }: ExecutiveSummaryCardProps) {
  const metrics = summary.aggregateMetrics;

  return (
    <Card title="Benchmark Suite Executive Summary" className="benchmark-summary-card">
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
        <span>Git Commit: {summary.gitCommit}</span>
        <span>Host: {summary.hostDescription}</span>
        <span>Node: {summary.nodeVersion}</span>
      </div>
    </Card>
  );
}
