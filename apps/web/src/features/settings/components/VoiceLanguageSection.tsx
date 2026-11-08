import { VOICE_LANGUAGE_OPTIONS } from '../../voice/types';
import type { AppSettings } from '../types';

interface VoiceLanguageSectionProps {
  readonly form: AppSettings;
  readonly onChange: (patch: Partial<AppSettings>) => void;
  readonly onTestGnani: () => void;
  readonly pingStatus?: string | undefined;
}

export function VoiceLanguageSection({
  form,
  onChange,
  onTestGnani,
  pingStatus,
}: VoiceLanguageSectionProps) {
  return (
    <>
      <section id="sub-active-model" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Spoken Language</h2>
        </div>
        <p className="subsection-desc">
          Gnani Prisma understands ten Indian languages and code-mixed speech such as Hinglish. Pick
          a pair to bias recognition, or let it auto-detect.
        </p>
        <label className="field-group">
          <span className="field-label">Recognition language</span>
          <select
            className="input-select"
            value={form.voiceLanguage}
            onChange={(e) => onChange({ voiceLanguage: e.target.value })}
          >
            {VOICE_LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="toggle-card" style={{ marginTop: '12px' }}>
          <div className="toggle-card-content">
            <span className="toggle-card-title">Speak replies aloud</span>
            <span className="toggle-card-desc">
              Gnani Timbre answers in the language you spoke, so a Hindi command gets a Hindi
              confirmation.
            </span>
          </div>
          <input
            type="checkbox"
            className="toggle-switch-checkbox"
            checked={form.speakReplies}
            onChange={(e) => onChange({ speakReplies: e.target.checked })}
          />
        </label>
      </section>

      <section id="sub-api-credentials" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Gnani Connection</h2>
        </div>
        <p className="subsection-desc">
          The API key lives only in the server environment (<code>GNANI_API_KEY</code>), never in
          the browser. This check asks the server whether Prisma and Timbre are enabled.
        </p>
        <div className="test-action-row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onTestGnani}>
            <span>Check Gnani Connection</span>
          </button>
          {pingStatus && <span className="ping-feedback-pill success">{pingStatus}</span>}
        </div>
      </section>

      <section id="sub-autonomous-voice" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Autonomous Meeting SRE Intervention</h2>
        </div>
        <p className="subsection-desc">
          Allow Echma to listen during live architecture reviews and speak up when risks are
          detected.
        </p>

        <div className="toggle-cards-column">
          <label className="toggle-card">
            <div className="toggle-card-content">
              <span className="toggle-card-title">Enable Autonomous Speech Interventions</span>
              <span className="toggle-card-desc">
                Echma will speak, in Hindi or English, to flag missing timeouts or cascading retries
                during calls.
              </span>
            </div>
            <input
              type="checkbox"
              className="toggle-switch-checkbox"
              checked={form.autonomousSreVoice}
              onChange={(e) => onChange({ autonomousSreVoice: e.target.checked })}
            />
          </label>

          <div className="field-group" style={{ marginTop: '12px' }}>
            <span className="field-label">Severity Yield Floor</span>
            <select
              className="input-select"
              value={form.sreSeverityYieldFloor}
              onChange={(e) =>
                onChange({
                  sreSeverityYieldFloor: e.target.value as 'medium' | 'high' | 'critical',
                })
              }
            >
              <option value="critical">
                Critical Only: Alert only on imminent cluster failure
              </option>
              <option value="high">
                High &amp; Critical (Recommended): Flag retries without backoff
              </option>
              <option value="medium">
                Medium, High &amp; Critical: Participate on minor latency slips
              </option>
            </select>
          </div>
        </div>
      </section>
    </>
  );
}
