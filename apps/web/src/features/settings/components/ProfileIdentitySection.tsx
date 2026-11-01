import type { AppSettings } from '../types';
import { useToast } from '../../toast';

interface ProfileIdentitySectionProps {
  readonly form: AppSettings;
  readonly onChange: (patch: Partial<AppSettings>) => void;
}

export function ProfileIdentitySection({ form, onChange }: ProfileIdentitySectionProps) {
  const toast = useToast();

  const sessionToken =
    typeof window !== 'undefined'
      ? (localStorage.getItem('chaosboard_token') ?? 'sre-session-demo-token-2026')
      : 'sre-session-demo-token-2026';

  const handleCopyToken = () => {
    void navigator.clipboard.writeText(sessionToken);
    toast.success('Session token copied to clipboard.', 'Copied');
  };

  return (
    <>
      <section id="sub-reviewer-credentials" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Staff Identity &amp; Role Title</h2>
        </div>
        <p className="subsection-desc">
          Your reviewer identity displayed to peers in multi-cursor review sessions.
        </p>

        <div className="settings-form-grid">
          <label className="field-group">
            <span className="field-label">Full Name</span>
            <input
              type="text"
              className="input-text"
              value={form.reviewerName}
              onChange={(e) => onChange({ reviewerName: e.target.value })}
              placeholder="Alex Chen"
            />
          </label>

          <label className="field-group">
            <span className="field-label">Corporate Email</span>
            <input
              type="email"
              className="input-text"
              value={form.reviewerEmail}
              onChange={(e) => onChange({ reviewerEmail: e.target.value })}
              placeholder="alex.chen@meta.internal"
            />
          </label>

          <label className="field-group" style={{ gridColumn: 'span 2' }}>
            <span className="field-label">SRE Role &amp; Title</span>
            <input
              type="text"
              className="input-text"
              value={form.reviewerRole}
              onChange={(e) => onChange({ reviewerRole: e.target.value })}
              placeholder="Staff Site Reliability Engineer"
            />
          </label>
        </div>
      </section>

      <section id="sub-org-badge" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Team &amp; Organization Workspace</h2>
        </div>
        <p className="subsection-desc">
          Department or organizational unit associated with this resilience review workspace.
        </p>

        <div className="field-group">
          <span className="field-label">Organization Name</span>
          <input
            type="text"
            className="input-text"
            value={form.organization}
            onChange={(e) => onChange({ organization: e.target.value })}
            placeholder="Meta Infrastructure Core"
          />
        </div>
      </section>

      <section id="sub-session-token" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Active Cryptographic Session Token</h2>
        </div>
        <p className="subsection-desc">
          Your cryptographically signed Bearer session token used by the client for Fastify REST
          requests.
        </p>

        <div className="token-viewer-box">
          <div className="token-text-preview">{sessionToken}</div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyToken}>
            Copy Bearer Token
          </button>
        </div>
      </section>
    </>
  );
}
