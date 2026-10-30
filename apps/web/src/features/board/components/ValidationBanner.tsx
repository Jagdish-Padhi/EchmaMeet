import type { TopologyProblem } from '@chaosboard/contracts';
import { Alert } from '../../../components/ui/Alert';

export interface ValidationBannerProps {
  readonly problems: readonly TopologyProblem[];
  readonly isValidating: boolean;
}

export function ValidationBanner({ problems, isValidating }: ValidationBannerProps) {
  if (isValidating || problems.length === 0) {
    return null;
  }

  return (
    <Alert variant="error" title={`${String(problems.length)} Validation Issues`}>
      <ul className="problem-list">
        {problems.map((p, idx) => (
          <li key={`${p.code}-${String(idx)}`} className="problem-item">
            <strong>[{p.code}]</strong> {p.message}
            {p.nodeId && <span className="problem-target"> (Node: {p.nodeId})</span>}
            {p.edgeId && <span className="problem-target"> (Edge: {p.edgeId})</span>}
          </li>
        ))}
      </ul>
    </Alert>
  );
}
