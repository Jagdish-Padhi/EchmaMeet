import type { AppSettings } from '../types';

interface ChaosEngineSectionProps {
  readonly form: AppSettings;
  readonly onChange: (patch: Partial<AppSettings>) => void;
  readonly onTestToxiproxy: () => void;
  readonly pingStatus?: string | undefined;
}

export function ChaosEngineSection({
  form,
  onChange,
  onTestToxiproxy,
  pingStatus,
}: ChaosEngineSectionProps) {
  return (
    <>
      <section id="sub-control-plane" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Control Plane &amp; Daemon Endpoints</h2>
        </div>
        <p className="subsection-desc">
          Local Fastify microservices orchestration and Shopify Toxiproxy degradation harness.
        </p>

        <div className="settings-form-grid">
          <label className="field-group">
            <span className="field-label">Control Plane Server URL</span>
            <input
              type="text"
              className="input-text"
              value={form.serverUrl}
              onChange={(e) => onChange({ serverUrl: e.target.value })}
              placeholder="http://127.0.0.1:8787"
            />
            <span className="field-hint">Fastify REST API &amp; Server-Sent Events daemon.</span>
          </label>

          <label className="field-group">
            <span className="field-label">Shopify Toxiproxy URL</span>
            <input
              type="text"
              className="input-text"
              value={form.toxiproxyUrl}
              onChange={(e) => onChange({ toxiproxyUrl: e.target.value })}
              placeholder="http://127.0.0.1:8474"
            />
            <span className="field-hint">Toxiproxy HTTP control API socket.</span>
          </label>

          <label className="field-group" style={{ gridColumn: 'span 2' }}>
            <span className="field-label">Upstream Routing Host</span>
            <input
              type="text"
              className="input-text"
              value={form.toxiproxyUpstreamHost}
              onChange={(e) => onChange({ toxiproxyUpstreamHost: e.target.value })}
              placeholder="host.docker.internal or 127.0.0.1"
            />
            <span className="field-hint">
              Target address mapped through Toxiproxy downstream listeners.
            </span>
          </label>
        </div>

        <div className="test-action-row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onTestToxiproxy}>
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span>Ping Toxiproxy Daemon</span>
          </button>
          {pingStatus && <span className="ping-feedback-pill info">{pingStatus}</span>}
        </div>
      </section>

      <section id="sub-default-faults" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Default Toxic Injection Baseline</h2>
        </div>
        <p className="subsection-desc">
          Default parameters applied when injecting network faults or running automated chaos tests.
        </p>

        <div className="settings-form-grid">
          <label className="field-group">
            <span className="field-label">Default Latency (ms)</span>
            <input
              type="number"
              min={10}
              max={10000}
              className="input-number"
              value={form.defaultLatencyMs}
              onChange={(e) => onChange({ defaultLatencyMs: parseInt(e.target.value, 10) || 100 })}
            />
          </label>

          <label className="field-group">
            <span className="field-label">Default Jitter Window (ms)</span>
            <input
              type="number"
              min={0}
              max={2000}
              className="input-number"
              value={form.defaultJitterMs}
              onChange={(e) => onChange({ defaultJitterMs: parseInt(e.target.value, 10) || 0 })}
            />
          </label>

          <label className="field-group">
            <span className="field-label">Default Toxicity Ratio (0 to 1)</span>
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.1}
              className="input-number"
              value={form.defaultToxicity}
              onChange={(e) => onChange({ defaultToxicity: parseFloat(e.target.value) || 1 })}
            />
          </label>

          <label className="field-group">
            <span className="field-label">TCP Connection Reset Cutoff (ms)</span>
            <input
              type="number"
              min={10}
              max={5000}
              className="input-number"
              value={form.connectionResetCutoffMs}
              onChange={(e) =>
                onChange({ connectionResetCutoffMs: parseInt(e.target.value, 10) || 100 })
              }
            />
          </label>
        </div>
      </section>

      <section id="sub-daemon-safety" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Network Safety &amp; Auto-Drain</h2>
        </div>
        <p className="subsection-desc">
          Ensure test traffic and injected faults are cleanly pruned upon session teardown.
        </p>

        <label className="toggle-card">
          <div className="toggle-card-content">
            <span className="toggle-card-title">Auto-drain proxies upon test completion</span>
            <span className="toggle-card-desc">
              Restores unthrottled TCP passthrough immediately when an experiment ends or is
              cancelled.
            </span>
          </div>
          <input
            type="checkbox"
            className="toggle-switch-checkbox"
            checked={form.autoDrainProxiesOnExit}
            onChange={(e) => onChange({ autoDrainProxiesOnExit: e.target.checked })}
          />
        </label>
      </section>
    </>
  );
}
