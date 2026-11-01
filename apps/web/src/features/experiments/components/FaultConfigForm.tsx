import { catalog, type EdgeId, type Fault } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';

export interface FaultConfigFormProps {
  readonly fault: Fault;
  readonly availableEdges: readonly EdgeId[];
  readonly edges?: readonly { id: string; source: string; target: string }[];
  readonly nodes?: readonly { id: string; label: string }[];
  readonly onChange: (fault: Fault) => void;
  readonly disabled?: boolean;
}

export function FaultConfigForm({
  fault,
  availableEdges,
  edges,
  nodes,
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

  const getEdgeLabel = (edgeId: string) => {
    if (edges && nodes) {
      const edge = edges.find((e) => e.id === edgeId);
      if (edge) {
        const src = nodes.find((n) => n.id === edge.source);
        const tgt = nodes.find((n) => n.id === edge.target);
        if (src && tgt) {
          return `${src.label} → ${tgt.label} (${edgeId})`;
        }
      }
    }
    return edgeId;
  };

  return (
    <Card title="Chaos Fault Injection" className="config-card">
      <div className="form-grid">
        <label className="field-group">
          <span className="field-label">Fault Profile</span>
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
            <option value="latency">Tail Latency &amp; Jitter (TCP Delay)</option>
            <option value="bandwidth_limit">Bandwidth Throttling (Rate Limit)</option>
            <option value="connection_reset">Connection Reset (TCP RST)</option>
            <option value="stall">Connection Blackhole / Stall (Timeout)</option>
          </select>
        </label>

        <label className="field-group">
          <span className="field-label">Target Network Link</span>
          <select
            className="input-select"
            value={fault.edgeId}
            disabled={disabled || availableEdges.length === 0}
            onChange={(e) => onChange({ ...fault, edgeId: e.target.value as EdgeId })}
          >
            {availableEdges.length === 0 ? (
              <option value="">No network connections available</option>
            ) : (
              availableEdges.map((e) => (
                <option key={e} value={e}>
                  {getEdgeLabel(e)}
                </option>
              ))
            )}
          </select>
        </label>

        {fault.type === 'latency' && (
          <div className="fields-split-row">
            <label className="field-group">
              <span className="field-label">Added Latency (ms)</span>
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
              <span className="field-label">Jitter Spread (ms)</span>
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
          </div>
        )}

        {fault.type === 'bandwidth_limit' && (
          <label className="field-group">
            <span className="field-label">Bandwidth Cap (kb/sec)</span>
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

        <label className="field-group">
          <span className="field-label">Fault Toxicity (Traffic Ratio: 1.0 = 100%)</span>
          <input
            type="number"
            className="input-number"
            min={0.1}
            max={1.0}
            step={0.1}
            value={fault.toxicity ?? 1}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...fault,
                toxicity: Math.min(1, Math.max(0.1, parseFloat(e.target.value) || 1)),
              })
            }
          />
        </label>
      </div>
    </Card>
  );
}
