import type { TrialConfig } from '@chaosboard/contracts';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';

export interface TrialControlsProps {
  readonly config: TrialConfig;
  readonly status: 'idle' | 'starting' | 'running' | 'completed' | 'cancelled' | 'failed' | 'busy';
  readonly onConfigChange: (config: TrialConfig) => void;
  readonly onStart: () => void;
  readonly onCancel: () => void;
  readonly canStart: boolean;
}

export function TrialControls({
  config,
  status,
  onConfigChange,
  onStart,
  onCancel,
  canStart,
}: TrialControlsProps) {
  const isRunning = status === 'running' || status === 'starting';

  return (
    <Card title="Experiment Execution" className="config-card">
      <div className="trial-controls-grid">
        <label className="field-group">
          <span className="field-label">Trials per condition</span>
          <input
            type="number"
            className="input-number"
            min={1}
            max={10}
            value={config.trials}
            disabled={isRunning}
            onChange={(e) =>
              onConfigChange({
                ...config,
                trials: parseInt(e.target.value, 10) || 1,
              })
            }
          />
        </label>

        <label className="field-group">
          <span className="field-label">Measurement Duration (ms)</span>
          <input
            type="number"
            className="input-number"
            min={1000}
            max={60000}
            value={config.measurementMs}
            disabled={isRunning}
            onChange={(e) =>
              onConfigChange({
                ...config,
                measurementMs: parseInt(e.target.value, 10) || 5000,
              })
            }
          />
        </label>

        <label className="field-group">
          <span className="field-label">Arrival Rate (RPS)</span>
          <input
            type="number"
            className="input-number"
            min={1}
            max={500}
            value={config.arrivalRateRps}
            disabled={isRunning}
            onChange={(e) =>
              onConfigChange({
                ...config,
                arrivalRateRps: parseInt(e.target.value, 10) || 10,
              })
            }
          />
        </label>

        <div className="trial-actions">
          {isRunning ? (
            <Button variant="danger" onClick={onCancel}>
              Cancel Experiment
            </Button>
          ) : (
            <Button variant="primary" disabled={!canStart} onClick={onStart}>
              Run Chaos Experiment
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
