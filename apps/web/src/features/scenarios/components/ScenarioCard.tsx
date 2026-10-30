import type { ScenarioSpec } from '@chaosboard/contracts';
import { Badge } from '../../../components/ui/Badge';

export interface ScenarioCardProps {
  readonly scenario: ScenarioSpec;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
}

export function ScenarioCard({ scenario, isSelected, onSelect }: ScenarioCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`scenario-card ${isSelected ? 'scenario-card-selected' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="scenario-card-header">
        <h4 className="scenario-card-title">{scenario.name}</h4>
        <Badge variant={isSelected ? 'accent' : 'neutral'}>
          {scenario.topology.nodes.length} nodes
        </Badge>
      </div>
      <p className="scenario-card-desc">{scenario.description}</p>
      <div className="scenario-card-meta">
        <span className="scenario-mode-badge">{scenario.designedFailureMode}</span>
      </div>
    </div>
  );
}
