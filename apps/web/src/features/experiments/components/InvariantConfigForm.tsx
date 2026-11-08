import type { Comparator, Invariant, InvariantMetric } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';

export interface InvariantConfigFormProps {
  readonly invariants: readonly Invariant[];
  readonly onChange: (invariants: readonly Invariant[]) => void;
  readonly disabled?: boolean;
}

const METRIC_LABELS: Partial<Record<InvariantMetric, { label: string; unit: string }>> = {
  e2e_p99_ms: { label: 'p99 Tail Latency', unit: 'ms' },
  e2e_error_rate: { label: 'Error Rate', unit: 'ratio' },
  completion_rate: { label: 'Completion Rate', unit: 'ratio' },
  retry_amplification: { label: 'Retry Amplification', unit: 'ratio' },
  worker_saturation: { label: 'Worker Saturation', unit: 'ratio' },
  queue_depth_max: { label: 'Max Queue Depth', unit: 'reqs' },
};

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
    <Card title="System Invariants &amp; SLOs" className="config-card">
      <p className="card-subtext">
        Simulation verifies if these quantitative reliability bounds hold during chaos injection:
      </p>
      <div className="invariants-list">
        {invariants.map((inv, idx) => {
          const metricMeta = METRIC_LABELS[inv.metric] ?? { label: inv.metric, unit: '' };

          return (
            <div key={inv.id} className="invariant-item-card">
              <div className="invariant-item-header">
                <span className="invariant-id-badge cell-mono">{inv.id}</span>
                <span className="invariant-metric-name">{metricMeta.label}</span>
              </div>

              <div className="invariant-item-controls">
                <select
                  className="input-select select-sm metric-select"
                  value={inv.metric}
                  disabled={disabled}
                  onChange={(e) => handleUpdate(idx, { metric: e.target.value as InvariantMetric })}
                >
                  <option value="e2e_p99_ms">e2e_p99_ms (Latency)</option>
                  <option value="e2e_error_rate">e2e_error_rate (Errors)</option>
                  <option value="completion_rate">completion_rate (Availability)</option>
                  <option value="retry_amplification">retry_amplification (Storm)</option>
                  <option value="worker_saturation">worker_saturation (Capacity)</option>
                  <option value="queue_depth_max">queue_depth_max (Backpressure)</option>
                </select>

                <select
                  className="input-select select-sm select-narrow comparator-select"
                  value={inv.comparator}
                  disabled={disabled}
                  onChange={(e) => handleUpdate(idx, { comparator: e.target.value as Comparator })}
                >
                  <option value="lte">&le;</option>
                  <option value="lt">&lt;</option>
                  <option value="gte">&ge;</option>
                  <option value="gt">&gt;</option>
                </select>

                <div className="threshold-input-wrapper">
                  <input
                    type="number"
                    step="any"
                    className="input-number input-sm threshold-input"
                    value={inv.threshold}
                    disabled={disabled}
                    onChange={(e) =>
                      handleUpdate(idx, { threshold: parseFloat(e.target.value) || 0 })
                    }
                  />
                  {metricMeta.unit && <span className="threshold-unit">{metricMeta.unit}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
