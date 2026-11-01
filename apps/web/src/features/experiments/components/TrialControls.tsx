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
  readonly onForceReset?: (() => void) | undefined;
}

export function TrialControls({
  config,
  status,
  onConfigChange,
  onStart,
  onCancel,
  canStart,
  onForceReset,
}: TrialControlsProps) {
  const isRunning = status === 'running' || status === 'starting';

  return (
    <Card title="Simulation Load Profile" className="config-card">
      <div className="trial-controls-grid">
        <label className="field-group">
          <span className="field-label">Trials per Condition</span>
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
          <span className="field-help-text">
            Executes {String(config.trials)} baseline trials + {String(config.trials)} faulted trials ({String(config.trials * 2)} total)
          </span>
        </label>

        <div className="fields-split-row">
          <label className="field-group">
            <span className="field-label">Duration / Trial (ms)</span>
            <input
              type="number"
              className="input-number"
              min={1000}
              max={60000}
              step={1000}
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
        </div>

        <div className="trial-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {isRunning ? (
            <Button variant="danger" onClick={onCancel} className="btn-full-width">
              Halt Resilience Simulation
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!canStart}
              onClick={onStart}
              className="btn-full-width"
              title={!canStart ? 'Resolve topology incompatibilities before running simulation' : 'Start resilience test'}
            >
              Execute Resilience Simulation
            </Button>
          )}

          {status === 'busy' && onForceReset && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onForceReset}
              className="btn-full-width"
              title="Clear single-host mutual exclusion lock and release sandbox"
            >
              Force Release Host Lock
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
