import type { Comparator, Invariant, InvariantMetric } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';

export interface InvariantConfigFormProps {
  readonly invariants: readonly Invariant[];
  readonly onChange: (invariants: readonly Invariant[]) => void;
  readonly disabled?: boolean;
}

export function InvariantConfigForm({
  invariants,
  onChange,
  disabled = false,
}: InvariantConfigFormProps) {
  const handleUpdate = (index: number, patch: Partial<Invariant>) => {
    const current = invariants[index];
    if (current) {
      const next = [...invariants];
      next[index] = { ...current, ...patch };
      onChange(next);
    }
  };

  return (
    <Card title="System Invariants" className="config-card">
      <div className="invariants-list">
        {invariants.map((inv, idx) => (
          <div key={inv.id} className="invariant-row">
            <span className="invariant-id">{inv.id}</span>
            <select
              className="input-select select-sm"
              value={inv.metric}
              disabled={disabled}
              onChange={(e) => handleUpdate(idx, { metric: e.target.value as InvariantMetric })}
            >
              <option value="e2e_p99_ms">e2e_p99_ms</option>
              <option value="e2e_error_rate">e2e_error_rate</option>
              <option value="completion_rate">completion_rate</option>
              <option value="retry_amplification">retry_amplification</option>
              <option value="worker_saturation">worker_saturation</option>
              <option value="queue_depth_max">queue_depth_max</option>
            </select>

            <select
              className="input-select select-sm select-narrow"
              value={inv.comparator}
              disabled={disabled}
              onChange={(e) => handleUpdate(idx, { comparator: e.target.value as Comparator })}
            >
              <option value="lte">&le;</option>
              <option value="lt">&lt;</option>
              <option value="gte">&ge;</option>
              <option value="gt">&gt;</option>
            </select>

            <input
              type="number"
              step="any"
              className="input-number input-sm"
              value={inv.threshold}
              disabled={disabled}
              onChange={(e) => handleUpdate(idx, { threshold: parseFloat(e.target.value) || 0 })}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
