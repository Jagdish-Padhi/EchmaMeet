import type { AppSettings } from '../types';

interface ReviewRoomsSectionProps {
  readonly form: AppSettings;
  readonly onChange: (patch: Partial<AppSettings>) => void;
}

export function ReviewRoomsSection({ form, onChange }: ReviewRoomsSectionProps) {
  return (
    <>
      <section id="sub-room-presence" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Real-Time Presence &amp; Collaboration</h2>
        </div>
        <p className="subsection-desc">
          Broadcast multi-cursor pointers, live node selections, and peer SRE badges.
        </p>

        <div className="settings-form-grid">
          <label className="field-group">
            <span className="field-label">Default Meeting Room Prefix</span>
            <input
              type="text"
              className="input-text"
              value={form.defaultRoomPrefix}
              onChange={(e) => onChange({ defaultRoomPrefix: e.target.value })}
              placeholder="#rfc-"
            />
          </label>

          <div className="toggle-card" style={{ gridColumn: 'span 2' }}>
            <div className="toggle-card-content">
              <span className="toggle-card-title">Broadcast Cursor &amp; Node Highlights</span>
              <span className="toggle-card-desc">
                Shares your cursor pointer position and selected node with all peers in the room.
              </span>
            </div>
            <input
              type="checkbox"
              className="toggle-switch-checkbox"
              checked={form.broadcastPresence}
              onChange={(e) => onChange({ broadcastPresence: e.target.checked })}
            />
          </div>
        </div>
      </section>

      <section id="sub-voice-webrtc" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Spatial Push-to-Talk &amp; Audio Filtering</h2>
        </div>
        <p className="subsection-desc">
          Microphone capture mode and AI noise cancellation during team architectural reviews.
        </p>

        <div className="toggle-cards-column">
          <label className="toggle-card">
            <div className="toggle-card-content">
              <span className="toggle-card-title">Push-to-Talk (Hold Spacebar)</span>
              <span className="toggle-card-desc">
                Transmits voice only while holding Spacebar or the floating microphone button.
              </span>
            </div>
            <input
              type="checkbox"
              className="toggle-switch-checkbox"
              checked={form.pushToTalkEnabled}
              onChange={(e) => onChange({ pushToTalkEnabled: e.target.checked })}
            />
          </label>

          <label className="toggle-card">
            <div className="toggle-card-content">
              <span className="toggle-card-title">AI Background Noise Suppression</span>
              <span className="toggle-card-desc">
                Filters typing noise and background office audio from team review calls.
              </span>
            </div>
            <input
              type="checkbox"
              className="toggle-switch-checkbox"
              checked={form.noiseSuppression}
              onChange={(e) => onChange({ noiseSuppression: e.target.checked })}
            />
          </label>
        </div>
      </section>

      <section id="sub-adr-export" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">ADR Architecture RFC Generation</h2>
        </div>
        <p className="subsection-desc">
          Format used when clicking &ldquo;Export ADR / RFC&rdquo; in the Live Review Room.
        </p>

        <div className="field-group">
          <span className="field-label">Export Target Format</span>
          <select
            className="input-select"
            value={form.adrExportFormat}
            onChange={(e) =>
              onChange({
                adrExportFormat: e.target.value as 'markdown' | 'github_pr' | 'confluence',
              })
            }
          >
            <option value="markdown">Markdown ADR (Standard Architecture Decision Record)</option>
            <option value="github_pr">GitHub PR Description Template</option>
            <option value="confluence">Atlassian Confluence JSON Format</option>
          </select>
        </div>
      </section>
    </>
  );
}
