import { Card } from '../../../components/ui/Card';

export function SurprisesSection() {
  return (
    <Card title="Surprises & Unexpected Outcomes" className="surprises-card">
      <ol className="surprises-list">
        <li>
          <strong>Static Predictor Magnitude Miscalibration:</strong> While static LLMs reliably
          identify conceptual vulnerabilities (such as retries exacerbating delay or missing
          timeouts holding connections), quantitative latency estimates diverge markedly from
          sandbox measurements (typically by 2x-5x magnitude ratio), underscoring the necessity of
          real process execution.
        </li>
        <li>
          <strong>Availability vs Consistency Bound:</strong> In{' '}
          <span className="cell-mono">availability-tradeoff</span>, where a critical write
          downstream dependency was down, neither the rule-based heuristics nor the model could
          reach PASS without violating consistency invariants, correctly yielding an honest{' '}
          <span className="cell-mono">TRADE_OFF</span> report rather than a false resolution.
        </li>
      </ol>
    </Card>
  );
}
