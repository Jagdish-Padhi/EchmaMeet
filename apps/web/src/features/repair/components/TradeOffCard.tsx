import type { TradeOffReport } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';

export interface TradeOffCardProps {
  readonly report: TradeOffReport | null;
}

export function TradeOffCard({ report }: TradeOffCardProps) {
  if (!report) return null;

  return (
    <Card title="Pareto Trade-Off Analysis" className="tradeoff-card">
      <div className="tradeoff-content">
        <p className="tradeoff-summary">
          <strong>Bottleneck:</strong> {report.bottleneckReason}
        </p>
        <div className="tradeoff-reasons">
          <h4>Engineering Recommendations:</h4>
          <ul>
            {report.humanRecommendations.map((rec, i) => (
              <li key={String(i)}>{rec}</li>
            ))}
          </ul>
        </div>
        <div className="tradeoff-meta">
          <span>Iterations evaluated: {String(report.iterationsTried)}</span>
          <span>Unsatisfied invariants: {String(report.unsatisfiedInvariants.length)}</span>
        </div>
      </div>
    </Card>
  );
}
