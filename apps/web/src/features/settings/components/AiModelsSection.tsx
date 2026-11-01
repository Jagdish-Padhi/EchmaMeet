import type { AppSettings } from '../types';

interface AiModelsSectionProps {
  readonly form: AppSettings;
  readonly onChange: (patch: Partial<AppSettings>) => void;
  readonly onTestMetaAi: () => void;
  readonly pingStatus?: string | undefined;
  readonly showApiKey: boolean;
  readonly onToggleApiKey: () => void;
}

const FOUNDATION_MODELS = [
  {
    id: 'muse-wonder-1.0',
    name: 'Muse Wonder 1.0',
    tag: 'Frontier Agentic',
    context: '1M Context',
    specs: 'SOTA coding, multi-turn agentic tool calling, and automated fault recovery.',
    badgeColor: '#38bdf8',
  },
  {
    id: 'muse-spark-1.3',
    name: 'Muse Spark 1.3',
    tag: 'Coding Optimized',
    context: '1M Context',
    specs: 'Fast iterative code generation, MCP tools, and live patch synthesis.',
    badgeColor: '#818cf8',
  },
  {
    id: 'muse-spark-open-1026',
    name: 'Muse Spark Open',
    tag: 'Open Weights',
    context: 'Self-Hosted',
    specs: 'Meta open weights runnable locally on Ollama, vLLM, or self-hosted GPU.',
    badgeColor: '#34d399',
  },
  {
    id: 'muse-glimmer-30b',
    name: 'Muse Glimmer (30B)',
    tag: 'Edge Agent',
    context: 'Local GPU',
    specs: 'Lightweight always-on background agent tuned for rapid failure detection.',
    badgeColor: '#fbbf24',
  },
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B (Groq Fallback)',
    tag: 'Dev Testing',
    context: '128K Context',
    specs: 'Fast inference for local development, dry-runs, and CI testing.',
    badgeColor: '#f43f5e',
  },
] as const;

export function AiModelsSection({
  form,
  onChange,
  onTestMetaAi,
  pingStatus,
  showApiKey,
  onToggleApiKey,
}: AiModelsSectionProps) {
  return (
    <>
      <section id="sub-active-model" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Active Foundation Model</h2>
        </div>
        <p className="subsection-desc">
          Select the Meta model powering architecture analysis, code reviews, and automated circuit
          breaker synthesis.
        </p>

        <div className="model-selection-grid">
          {FOUNDATION_MODELS.map((model) => {
            const isSelected = form.partnerModelId === model.id;
            return (
              <div
                key={model.id}
                className={`model-card-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onChange({ partnerModelId: model.id })}
              >
                <div className="model-card-header">
                  <div className="model-radio-circle">
                    {isSelected && <div className="model-radio-dot" />}
                  </div>
                  <div className="model-card-titles">
                    <span className="model-name">{model.name}</span>
                    <span
                      className="model-tag"
                      style={{
                        borderColor: `${model.badgeColor}40`,
                        color: model.badgeColor,
                      }}
                    >
                      {model.tag}
                    </span>
                  </div>
                  <span className="model-context">{model.context}</span>
                </div>
                <p className="model-card-specs">{model.specs}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="sub-api-credentials" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Provider API Endpoint &amp; Authentication</h2>
        </div>
        <p className="subsection-desc">
          Point to the official Meta dev endpoint, hackathon gateway, or an OpenAI-compatible proxy
          (Groq, vLLM).
        </p>

        <div className="settings-form-grid">
          <label className="field-group">
            <span className="field-label">Provider Base URL</span>
            <input
              type="text"
              className="input-text"
              value={form.partnerBaseUrl}
              onChange={(e) => onChange({ partnerBaseUrl: e.target.value })}
              placeholder="https://dev.meta.ai/v1 or http://127.0.0.1:8000/v1"
            />
            <span className="field-hint">OpenAI-compatible chat completion base endpoint.</span>
          </label>

          <label className="field-group">
            <span className="field-label">Meta AI / Partner API Key</span>
            <div className="input-with-button-wrap">
              <input
                type={showApiKey ? 'text' : 'password'}
                className="input-text"
                value={form.partnerApiKey}
                onChange={(e) => onChange({ partnerApiKey: e.target.value })}
                placeholder="meta_ai_live_... or gsk_... (Groq test key)"
              />
              <button type="button" className="btn-input-action" onClick={onToggleApiKey}>
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <span className="field-hint">
              Stored locally in encrypted browser storage. Never leaked to third parties.
            </span>
          </label>
        </div>

        <div className="test-action-row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onTestMetaAi}>
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>Verify Model Handshake</span>
          </button>
          {pingStatus && <span className="ping-feedback-pill success">{pingStatus}</span>}
        </div>
      </section>

      <section id="sub-hyperparameters" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Reasoning Depth &amp; Context Controls</h2>
        </div>
        <p className="subsection-desc">
          Control sampling temperature to balance determinism during SRE reviews with creative
          repair generation.
        </p>

        <div className="slider-controls-grid">
          <div className="slider-group">
            <div className="slider-header">
              <span className="slider-label">Temperature:</span>
              <span className="slider-value-badge">{form.modelTemperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              className="input-range-slider"
              value={form.modelTemperature}
              onChange={(e) => onChange({ modelTemperature: parseFloat(e.target.value) })}
            />
            <div className="slider-bounds">
              <span>0.0 (Deterministic)</span>
              <span>0.5 (Balanced)</span>
              <span>1.0 (Creative)</span>
            </div>
          </div>

          <div className="slider-group">
            <div className="slider-header">
              <span className="slider-label">Max Response Tokens:</span>
              <span className="slider-value-badge">{form.maxTokens} tokens</span>
            </div>
            <input
              type="range"
              min={512}
              max={8192}
              step={256}
              className="input-range-slider"
              value={form.maxTokens}
              onChange={(e) => onChange({ maxTokens: parseInt(e.target.value, 10) })}
            />
            <div className="slider-bounds">
              <span>512 (Fast)</span>
              <span>2048 (Recommended)</span>
              <span>8192 (Full Report)</span>
            </div>
          </div>
        </div>
      </section>

      <section id="sub-autonomous-voice" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Autonomous Meeting SRE Intervention</h2>
        </div>
        <p className="subsection-desc">
          Allow Meta AI SRE to actively listen during live architectural review calls and speak up
          when risks are detected.
        </p>

        <div className="toggle-cards-column">
          <label className="toggle-card">
            <div className="toggle-card-content">
              <span className="toggle-card-title">Enable Autonomous Speech Interventions</span>
              <span className="toggle-card-desc">
                Meta AI will synthesize audio to alert engineers of missing timeouts or cascading
                retries during calls.
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
