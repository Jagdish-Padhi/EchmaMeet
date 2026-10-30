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
      title="Autonomous Resilience Repair Loop"
      actions={<StatusPill status={status} />}
      className="repair-controls-card"
    >
      <div className="repair-controls-grid">
        <label className="field-group">
          <span className="field-label">Repair Strategy Proposer</span>
          <select
            className="input-select"
            value={proposerKind}
            disabled={isRunning}
            onChange={(e) => onProposerChange(e.target.value as RepairProposerKind)}
          >
            <option value="rule_based">Rule-Based Deterministic Baseline</option>
            <option value="model">Partner Model Agent (meta-models/muse-spark-open-1026)</option>
          </select>
        </label>

        <label className="field-group">
          <span className="field-label">Maximum Iterations</span>
          <input
            type="number"
            className="input-number"
            min={1}
            max={10}
            value={maxIterations}
            disabled={isRunning}
            onChange={(e) => onMaxIterationsChange(parseInt(e.target.value, 10) || 3)}
          />
        </label>

        <div className="repair-actions">
          {isRunning ? (
            <Button variant="danger" onClick={onCancel}>
              Cancel Repair Session
            </Button>
          ) : (
            <Button variant="primary" disabled={!canStart} onClick={onStart}>
              Start Autonomous Repair Loop
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
