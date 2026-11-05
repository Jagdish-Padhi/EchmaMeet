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
        <div className="tradeoff-bottleneck-banner">
          <span className="bottleneck-tag">Root Cause Bottleneck</span>
          <p className="bottleneck-reason">{report.bottleneckReason}</p>
        </div>

        <div className="tradeoff-reasons">
          <h4 className="tradeoff-subheading">Engineering Recommendations</h4>
          <ul className="tradeoff-recommendations-list">
            {report.humanRecommendations.map((rec, i) => (
              <li key={String(i)} className="tradeoff-rec-item">
                <span className="rec-bullet">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="tradeoff-meta-grid">
          <div className="meta-stat">
            <span className="meta-label">Iterations Tested</span>
            <span className="meta-value">{String(report.iterationsTried)}</span>
          </div>
          <div className="meta-stat">
            <span className="meta-label">Unsatisfied SLOs</span>
            <span
              className={`meta-value ${report.unsatisfiedInvariants.length > 0 ? 'amber' : 'green'}`}
            >
              {String(report.unsatisfiedInvariants.length)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
