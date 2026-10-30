import { catalog, type EdgeId, type Fault } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';

export interface FaultConfigFormProps {
  readonly fault: Fault;
  readonly availableEdges: readonly EdgeId[];
  readonly onChange: (fault: Fault) => void;
  readonly disabled?: boolean;
}

export function FaultConfigForm({
  fault,
  availableEdges,
  onChange,
  disabled = false,
}: FaultConfigFormProps) {
  const { fault: faultBounds } = catalog;

  const handleTypeChange = (
    newType: 'latency' | 'bandwidth_limit' | 'connection_reset' | 'stall',
  ) => {
    switch (newType) {
      case 'latency':
        onChange({
          id: fault.id,
          edgeId: fault.edgeId,
          toxicity: 1,
          direction: 'downstream',
          startOffsetMs: 0,
          type: 'latency',
          latencyMs: 500,
          jitterMs: 50,
        });
        break;
      case 'bandwidth_limit':
        onChange({
          id: fault.id,
          edgeId: fault.edgeId,
          toxicity: 1,
          direction: 'downstream',
          startOffsetMs: 0,
          type: 'bandwidth_limit',
          rateKbPerSec: 1024,
        });
        break;
      case 'connection_reset':
        onChange({
          id: fault.id,
          edgeId: fault.edgeId,
          toxicity: 1,
          direction: 'downstream',
          startOffsetMs: 0,
          type: 'connection_reset',
          afterMs: 0,
        });
        break;
      case 'stall':
        onChange({
          id: fault.id,
          edgeId: fault.edgeId,
          toxicity: 1,
          direction: 'downstream',
          startOffsetMs: 0,
          type: 'stall',
          holdMs: 3000,
        });
        break;
    }
  };

  return (
    <Card title="Chaos Fault Injection" className="config-card">
      <div className="form-grid">
        <label className="field-group">
          <span className="field-label">Fault Type</span>
          <select
            className="input-select"
            value={fault.type}
            disabled={disabled}
            onChange={(e) =>
              handleTypeChange(
                e.target.value as 'latency' | 'bandwidth_limit' | 'connection_reset' | 'stall',
              )
            }
          >
            <option value="latency">Latency / Jitter</option>
            <option value="bandwidth_limit">Bandwidth Limitation</option>
            <option value="connection_reset">Connection Reset (TCP RST)</option>
            <option value="stall">Connection Stall / Blackhole</option>
          </select>
        </label>

        <label className="field-group">
          <span className="field-label">Target Edge</span>
          <select
            className="input-select"
            value={fault.edgeId}
            disabled={disabled}
            onChange={(e) => onChange({ ...fault, edgeId: e.target.value as EdgeId })}
          >
            {availableEdges.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>

        {fault.type === 'latency' && (
          <>
            <label className="field-group">
              <span className="field-label">Latency (ms)</span>
              <input
                type="number"
                className="input-number"
                min={faultBounds.latencyMs.min}
                max={faultBounds.latencyMs.max}
                value={fault.latencyMs}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    ...fault,
                    latencyMs: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </label>
            <label className="field-group">
              <span className="field-label">Jitter (ms)</span>
              <input
                type="number"
                className="input-number"
                min={faultBounds.jitterMs.min}
                max={faultBounds.jitterMs.max}
                value={fault.jitterMs}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    ...fault,
                    jitterMs: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </label>
          </>
        )}

        {fault.type === 'bandwidth_limit' && (
          <label className="field-group">
            <span className="field-label">Rate (kb/sec)</span>
            <input
              type="number"
              className="input-number"
              min={faultBounds.bandwidthKbPerSec.min}
              max={faultBounds.bandwidthKbPerSec.max}
              value={fault.rateKbPerSec}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...fault,
                  rateKbPerSec: parseInt(e.target.value, 10) || 1024,
                })
              }
            />
          </label>
        )}

        {fault.type === 'stall' && (
          <label className="field-group">
            <span className="field-label">Hold Duration (ms)</span>
            <input
              type="number"
              className="input-number"
              min={faultBounds.stallHoldMs.min}
              max={faultBounds.stallHoldMs.max}
              value={fault.holdMs ?? 1000}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...fault,
                  holdMs: parseInt(e.target.value, 10) || 1000,
                })
              }
            />
          </label>
        )}
      </div>
    </Card>
  );
}
