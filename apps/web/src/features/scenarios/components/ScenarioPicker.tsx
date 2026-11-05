import type { ScenarioId, ScenarioSpec } from '@chaosboard/contracts';
import { Alert } from '../../../components/ui/Alert';
import { Card } from '../../../components/ui/Card';
import { ScenarioCard } from './ScenarioCard';

export interface ScenarioPickerProps {
  readonly scenarios: readonly ScenarioSpec[];
  readonly selectedScenarioId: ScenarioId | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onSelect: (id: ScenarioId) => void;
  readonly onLoadIntoBoard?: (scenario: ScenarioSpec) => void;
}

export function ScenarioPicker({
  scenarios,
  selectedScenarioId,
  isLoading,
  error,
  onSelect,
  onLoadIntoBoard,
}: ScenarioPickerProps) {
  if (isLoading) {
    return (
      <Card title="Benchmark Scenarios">
        <p className="state-message">Loading scenarios from benchmark catalog...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Benchmark Scenarios">
        <Alert variant="error" title="Failed to load scenarios">
          {error}
        </Alert>
      </Card>
    );
  }

  const selected = scenarios.find((s) => s.id === selectedScenarioId);

  return (
    <Card
      title="Benchmark Scenarios"
      actions={
        selected && onLoadIntoBoard ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onLoadIntoBoard(selected)}
          >
            Load Into Board
          </button>
        ) : undefined
      }
    >
      <div className="scenario-grid">
        {scenarios.map((sc) => (
          <ScenarioCard
            key={sc.id}
            scenario={sc}
            isSelected={sc.id === selectedScenarioId}
            onSelect={() => onSelect(sc.id)}
          />
        ))}
      </div>
    </Card>
  );
}
