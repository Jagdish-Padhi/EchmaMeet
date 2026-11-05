import type { AppSettings } from '../types';

interface TrialsGuardrailsSectionProps {
  readonly form: AppSettings;
  readonly onChange: (patch: Partial<AppSettings>) => void;
}

export function TrialsGuardrailsSection({ form, onChange }: TrialsGuardrailsSectionProps) {
  return (
    <>
      <section id="sub-trial-params" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Workload &amp; Duration Parameters</h2>
        </div>
        <p className="subsection-desc">
          Determine statistical confidence with repeated trials and load generation rates.
        </p>

        <div className="settings-form-grid">
          <label className="field-group">
            <span className="field-label">Repetition Count (Trials Per Condition)</span>
            <input
              type="number"
              min={1}
              max={10}
              className="input-number"
              value={form.defaultTrials}
              onChange={(e) => onChange({ defaultTrials: parseInt(e.target.value, 10) || 1 })}
            />
            <span className="field-hint">3 trials recommended for p99 statistical validity.</span>
          </label>

          <label className="field-group">
            <span className="field-label">Measurement Duration Per Trial (ms)</span>
            <input
              type="number"
              min={1000}
              max={30000}
              step={1000}
              className="input-number"
              value={form.measurementMs}
              onChange={(e) => onChange({ measurementMs: parseInt(e.target.value, 10) || 5000 })}
            />
            <span className="field-hint">5000ms captures transient queue buildups.</span>
          </label>

          <label className="field-group">
            <span className="field-label">Synthetic Traffic Arrival Rate (RPS)</span>
            <input
              type="number"
              min={5}
              max={500}
              step={5}
              className="input-number"
              value={form.arrivalRateRps}
              onChange={(e) => onChange({ arrivalRateRps: parseInt(e.target.value, 10) || 20 })}
            />
          </label>

          <label className="field-group">
            <span className="field-label">Parallel Worker Concurrency</span>
            <input
              type="number"
              min={1}
              max={16}
              className="input-number"
              value={form.workerConcurrency}
              onChange={(e) => onChange({ workerConcurrency: parseInt(e.target.value, 10) || 4 })}
            />
          </label>
        </div>
      </section>

      <section id="sub-rollback-guard" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Autonomous Rollback &amp; Regression Guards</h2>
        </div>
        <p className="subsection-desc">
          Safety mechanisms protecting production topology definitions from degraded candidate
          patches.
        </p>

        <div className="toggle-cards-column">
          <label className="toggle-card">
            <div className="toggle-card-content">
              <span className="toggle-card-title">Auto-Rollback on Invariant Regression</span>
              <span className="toggle-card-desc">
                Immediately revert candidate timeout/circuit-breaker values if empirical tests show
                worse p99 latency than baseline.
              </span>
            </div>
            <input
              type="checkbox"
              className="toggle-switch-checkbox"
              checked={form.autoRollback}
              onChange={(e) => onChange({ autoRollback: e.target.checked })}
            />
          </label>

          <label className="toggle-card">
            <div className="toggle-card-content">
              <span className="toggle-card-title">Enforce Strict SLI Boundaries</span>
              <span className="toggle-card-desc">
                Mark run as FAILED if any single simulated request exceeds 1.5x the defined p99
                threshold.
              </span>
            </div>
            <input
              type="checkbox"
              className="toggle-switch-checkbox"
              checked={form.strictInvariants}
              onChange={(e) => onChange({ strictInvariants: e.target.checked })}
            />
          </label>
        </div>
      </section>

      <section id="sub-telemetry-sampling" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Telemetry Resolution &amp; Invariant Criteria</h2>
        </div>
        <p className="subsection-desc">Granularity of live telemetry charts during stress tests.</p>

        <div className="field-group">
          <span className="field-label">Chart Telemetry Sample Interval</span>
          <select
            className="input-select"
            value={form.telemetrySampleRateMs}
            onChange={(e) =>
              onChange({
                telemetrySampleRateMs: parseInt(e.target.value, 10) || 100,
              })
            }
          >
            <option value={50}>50ms: Ultra-dense microburst detection</option>
            <option value={100}>100ms (Recommended): High precision enterprise monitoring</option>
            <option value={250}>250ms: Balanced CPU usage for large topologies</option>
          </select>
        </div>
      </section>
    </>
  );
}
