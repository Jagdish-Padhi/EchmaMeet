import type { RepairProposerKind, RepairStatus } from '@chaosboard/contracts';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';

export interface RepairControlsProps {
  readonly status: RepairStatus | 'idle' | 'starting';
  readonly proposerKind: RepairProposerKind;
  readonly maxIterations: number;
  readonly onProposerChange: (kind: RepairProposerKind) => void;
  readonly onMaxIterationsChange: (max: number) => void;
  readonly onStart: () => void;
  readonly onCancel: () => void;
  readonly canStart: boolean;
}

export function RepairControls({
  status,
  proposerKind,
  maxIterations,
  onProposerChange,
  onMaxIterationsChange,
  onStart,
  onCancel,
  canStart,
}: RepairControlsProps) {
  const isRunning = status === 'running' || status === 'starting';

  return (
    <Card
      title="Autonomous Resilience Repair"
      actions={<StatusPill status={status} />}
      className="repair-controls-card"
    >
      <div className="repair-controls-grid">
        <label className="field-group">
          <span className="field-label">Policy Proposer Strategy</span>
          <select
            className="input-select"
            value={proposerKind}
            disabled={isRunning}
            onChange={(e) => onProposerChange(e.target.value as RepairProposerKind)}
          >
            <option value="model">Partner Model Agent (Meta Llama 3.3 / Muse)</option>
            <option value="rule_based">Deterministic SRE Rules (Local Heuristic)</option>
          </select>
          <span className="field-help-text">
            {proposerKind === 'model'
              ? 'LLM agent evaluates simulation traces and proposes targeted policy patches (timeouts, retries, circuit breakers).'
              : 'Deterministic expert rules analyze queue depths and latency spikes without model inference.'}
          </span>
        </label>

        <label className="field-group">
          <span className="field-label">Max Iteration Depth</span>
          <input
            type="number"
            className="input-number"
            min={1}
            max={10}
            value={maxIterations}
            disabled={isRunning}
            onChange={(e) => onMaxIterationsChange(parseInt(e.target.value, 10) || 3)}
          />
          <span className="field-help-text">
            Stops as soon as all invariants pass or search space reaches {String(maxIterations)} iterations.
          </span>
        </label>

        <div className="repair-actions">
          {isRunning ? (
            <Button variant="danger" onClick={onCancel} className="btn-full-width">
              Cancel Repair Session
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!canStart}
              onClick={onStart}
              className="btn-full-width"
              title={!canStart ? 'Resolve topology incompatibilities before running repair' : 'Start autonomous repair loop'}
            >
              Start Autonomous Repair Loop
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
