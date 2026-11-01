import type { AppSettings } from '../types';

interface IacCloudSectionProps {
  readonly form: AppSettings;
  readonly onChange: (patch: Partial<AppSettings>) => void;
  readonly onTestNeon: () => void;
  readonly pingStatus?: string | undefined;
  readonly showDbUrl: boolean;
  readonly onToggleDbUrl: () => void;
}

export function IacCloudSection({
  form,
  onChange,
  onTestNeon,
  pingStatus,
  showDbUrl,
  onToggleDbUrl,
}: IacCloudSectionProps) {
  return (
    <>
      <section id="sub-database-backend" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Database &amp; Cache Storage Engine</h2>
        </div>
        <p className="subsection-desc">
          Configure Neon Serverless Postgres for cloud persistence, and Redis for distributed
          queueing.
        </p>

        <div className="settings-form-grid">
          <label className="field-group">
            <span className="field-label">Primary Database Engine</span>
            <select
              className="input-select"
              value={form.databaseProvider}
              onChange={(e) =>
                onChange({
                  databaseProvider: e.target.value as 'neon' | 'sqlite',
                })
              }
            >
              <option value="neon">Neon Serverless Postgres (Production)</option>
              <option value="sqlite">Local SQLite Embedded (Development)</option>
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">Redis Cache URL (BullMQ)</span>
            <input
              type="text"
              className="input-text"
              value={form.redisCacheUrl}
              onChange={(e) => onChange({ redisCacheUrl: e.target.value })}
              placeholder="redis://127.0.0.1:6379"
            />
          </label>

          <label className="field-group" style={{ gridColumn: 'span 2' }}>
            <span className="field-label">Neon Postgres Connection String</span>
            <div className="input-with-button-wrap">
              <input
                type={showDbUrl ? 'text' : 'password'}
                className="input-text"
                value={form.neonDatabaseUrl}
                onChange={(e) => onChange({ neonDatabaseUrl: e.target.value })}
                placeholder="postgresql://resilio_owner:...@ep-morning-moon-...neon.tech/neondb?sslmode=require"
              />
              <button type="button" className="btn-input-action" onClick={onToggleDbUrl}>
                {showDbUrl ? 'Hide' : 'Show'}
              </button>
            </div>
            <span className="field-hint">Automatically pulled by Neon CLI (`neon deploy`).</span>
          </label>
        </div>

        <div className="test-action-row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onTestNeon}>
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            <span>Test Neon DB Connection</span>
          </button>
          {pingStatus && <span className="ping-feedback-pill success">{pingStatus}</span>}
        </div>
      </section>

      <section id="sub-iac-targets" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Infrastructure as Code Generation Target</h2>
        </div>
        <p className="subsection-desc">
          Choose the target specification when exporting verified circuit breakers, rate limits, and
          retries.
        </p>

        <div className="field-group">
          <span className="field-label">Target Engine</span>
          <select
            className="input-select"
            value={form.defaultIacTarget}
            onChange={(e) =>
              onChange({
                defaultIacTarget: e.target.value as 'terraform' | 'kubernetes' | 'helm' | 'pulumi',
              })
            }
          >
            <option value="terraform">Terraform HCL (Envoy Proxy / AWS ECS / Consul)</option>
            <option value="kubernetes">Kubernetes EnvoyFilter CRDs (Istio / Linkerd)</option>
            <option value="helm">Helm Chart Values (Values.yaml)</option>
            <option value="pulumi">Pulumi TypeScript Infrastructure Package</option>
          </select>
        </div>
      </section>

      <section id="sub-gitops-sync" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">GitOps Continuous Sync</h2>
        </div>
        <p className="subsection-desc">
          Automate pushing verified patches to your infrastructure Git repository.
        </p>

        <label className="toggle-card">
          <div className="toggle-card-content">
            <span className="toggle-card-title">Auto-commit verified patch to Git branch</span>
            <span className="toggle-card-desc">
              Creates an automated PR with the verified circuit breaker thresholds and mathematical
              proof.
            </span>
          </div>
          <input
            type="checkbox"
            className="toggle-switch-checkbox"
            checked={form.gitOpsAutoCommit}
            onChange={(e) => onChange({ gitOpsAutoCommit: e.target.checked })}
          />
        </label>
      </section>
    </>
  );
}
