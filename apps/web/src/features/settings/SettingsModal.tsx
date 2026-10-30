import { useState } from 'react';
import { Button } from '../../components/ui/Button';

export interface AppSettings {
  serverUrl: string;
  toxiproxyUrl: string;
  partnerBaseUrl: string;
  partnerApiKey: string;
  partnerModelId: string;
  defaultTrials: number;
  measurementMs: number;
  arrivalRateRps: number;
  autoRollback: boolean;
  theme: 'dark' | 'light';
  gridStyle: 'dots' | 'cross' | 'plain';
}

export const DEFAULT_SETTINGS: AppSettings = {
  serverUrl: 'http://127.0.0.1:8787',
  toxiproxyUrl: 'http://127.0.0.1:8474',
  partnerBaseUrl: 'http://127.0.0.1:8000/v1',
  partnerApiKey: '',
  partnerModelId: 'meta-models/muse-spark-open-1026',
  defaultTrials: 3,
  measurementMs: 5000,
  arrivalRateRps: 20,
  autoRollback: true,
  theme: 'dark',
  gridStyle: 'dots',
};

const STORAGE_KEY = 'chaosboard_settings';

export function loadSettingsFromStorage(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return { ...DEFAULT_SETTINGS, ...(parsed as Partial<AppSettings>) };
      }
    }
  } catch {
    // fallback to defaults on storage error
  }
  return DEFAULT_SETTINGS;
}

export function saveSettingsToStorage(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export interface SettingsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (settings: AppSettings) => void;
  readonly currentSettings: AppSettings;
}

export function SettingsModal({ isOpen, onClose, onSave, currentSettings }: SettingsModalProps) {
  if (!isOpen) return null;
  return (
    <SettingsModalDialog onClose={onClose} onSave={onSave} currentSettings={currentSettings} />
  );
}

interface SettingsModalDialogProps {
  readonly onClose: () => void;
  readonly onSave: (settings: AppSettings) => void;
  readonly currentSettings: AppSettings;
}

function SettingsModalDialog({ onClose, onSave, currentSettings }: SettingsModalDialogProps) {
  const [activeSection, setActiveSection] = useState<'network' | 'model' | 'engine' | 'display'>(
    'network',
  );
  const [form, setForm] = useState<AppSettings>(currentSettings);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const handleSave = () => {
    saveSettingsToStorage(form);
    onSave(form);
    setSavedFeedback(true);
    setTimeout(() => {
      setSavedFeedback(false);
      onClose();
    }, 400);
  };

  const handleReset = () => {
    setForm(DEFAULT_SETTINGS);
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-heading"
    >
      <div className="settings-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-modal-header">
          <div className="settings-header-title">
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <h2 id="settings-heading">System &amp; Engine Configuration</h2>
          </div>
          <button
            type="button"
            className="btn-close-modal"
            onClick={onClose}
            aria-label="Close settings"
          >
            &times;
          </button>
        </div>

        {/* Content Body: Sidebar + Form Panels */}
        <div className="settings-modal-body">
          {/* Navigation Sidebar */}
          <nav className="settings-nav-sidebar" aria-label="Settings categories">
            <button
              type="button"
              className={`settings-nav-btn ${activeSection === 'network' ? 'active' : ''}`}
              onClick={() => setActiveSection('network')}
            >
              Control Plane &amp; Toxiproxy
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeSection === 'model' ? 'active' : ''}`}
              onClick={() => setActiveSection('model')}
            >
              Meta AI &amp; Partner Model
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeSection === 'engine' ? 'active' : ''}`}
              onClick={() => setActiveSection('engine')}
            >
              Trial Engine &amp; Guardrails
            </button>
            <button
              type="button"
              className={`settings-nav-btn ${activeSection === 'display' ? 'active' : ''}`}
              onClick={() => setActiveSection('display')}
            >
              Theme &amp; Canvas Ergonomics
            </button>
          </nav>

          {/* Form Content */}
          <div className="settings-content-panel">
            {activeSection === 'network' && (
              <div className="settings-section">
                <h3 className="settings-section-title">Control Plane &amp; Network Proxies</h3>
                <p className="settings-section-desc">
                  Configure local Fastify server binding and Toxiproxy fault injection daemon.
                </p>

                <label className="field-group">
                  <span className="field-label">Control Plane Server URL</span>
                  <input
                    type="text"
                    className="input-text"
                    value={form.serverUrl}
                    onChange={(e) => setForm({ ...form, serverUrl: e.target.value })}
                    placeholder="http://127.0.0.1:8787"
                  />
                  <span className="field-hint">
                    Fastify control plane REST &amp; WebSocket endpoint.
                  </span>
                </label>

                <label className="field-group">
                  <span className="field-label">Shopify Toxiproxy URL</span>
                  <input
                    type="text"
                    className="input-text"
                    value={form.toxiproxyUrl}
                    onChange={(e) => setForm({ ...form, toxiproxyUrl: e.target.value })}
                    placeholder="http://127.0.0.1:8474"
                  />
                  <span className="field-hint">
                    Toxiproxy HTTP control API used for network degradation.
                  </span>
                </label>
              </div>
            )}

            {activeSection === 'model' && (
              <div className="settings-section">
                <h3 className="settings-section-title">Meta AI &amp; Partner Open Model</h3>
                <p className="settings-section-desc">
                  OpenAI-compatible endpoint hosting Meta Spark Open weights or local Ollama/vLLM.
                </p>

                <label className="field-group">
                  <span className="field-label">Provider Base URL</span>
                  <input
                    type="text"
                    className="input-text"
                    value={form.partnerBaseUrl}
                    onChange={(e) => setForm({ ...form, partnerBaseUrl: e.target.value })}
                    placeholder="http://127.0.0.1:8000/v1"
                  />
                  <span className="field-hint">
                    Compatible with Fireworks, Together AI, Baseten, Ollama, vLLM.
                  </span>
                </label>

                <label className="field-group">
                  <span className="field-label">Partner API Key</span>
                  <input
                    type="password"
                    className="input-text"
                    value={form.partnerApiKey}
                    onChange={(e) => setForm({ ...form, partnerApiKey: e.target.value })}
                    placeholder="Leave empty for local inference or deterministic fallback"
                  />
                  <span className="field-hint">
                    Never sent to any third party other than your configured base URL.
                  </span>
                </label>

                <label className="field-group">
                  <span className="field-label">Model Identifier</span>
                  <input
                    type="text"
                    className="input-text"
                    value={form.partnerModelId}
                    onChange={(e) => setForm({ ...form, partnerModelId: e.target.value })}
                    placeholder="meta-models/muse-spark-open-1026"
                  />
                </label>
              </div>
            )}

            {activeSection === 'engine' && (
              <div className="settings-section">
                <h3 className="settings-section-title">Empirical Trial Engine Defaults</h3>
                <p className="settings-section-desc">
                  Configure trial repetition counts, duration, and workload synthetic traffic.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label className="field-group">
                    <span className="field-label">Default Trials Per Condition</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      className="input-number"
                      value={form.defaultTrials}
                      onChange={(e) =>
                        setForm({ ...form, defaultTrials: parseInt(e.target.value, 10) || 1 })
                      }
                    />
                  </label>

                  <label className="field-group">
                    <span className="field-label">Measurement Duration (ms)</span>
                    <input
                      type="number"
                      min={1000}
                      max={60000}
                      className="input-number"
                      value={form.measurementMs}
                      onChange={(e) =>
                        setForm({ ...form, measurementMs: parseInt(e.target.value, 10) || 5000 })
                      }
                    />
                  </label>
                </div>

                <label className="field-group">
                  <span className="field-label">Synthetic Workload Arrival Rate (RPS)</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    className="input-number"
                    value={form.arrivalRateRps}
                    onChange={(e) =>
                      setForm({ ...form, arrivalRateRps: parseInt(e.target.value, 10) || 10 })
                    }
                  />
                </label>

                <label className="checkbox-label" style={{ marginTop: '12px' }}>
                  <input
                    type="checkbox"
                    checked={form.autoRollback}
                    onChange={(e) => setForm({ ...form, autoRollback: e.target.checked })}
                  />
                  <span className="field-label" style={{ margin: 0 }}>
                    Auto-rollback candidate patch on empirical regression
                  </span>
                </label>
              </div>
            )}

            {activeSection === 'display' && (
              <div className="settings-section">
                <h3 className="settings-section-title">Theme &amp; Canvas Ergonomics</h3>
                <p className="settings-section-desc">
                  Choose between Obsidian Cyber-Observability dark mode and clean Excalidraw light
                  mode.
                </p>

                <label className="field-group">
                  <span className="field-label">Interface Theme</span>
                  <select
                    className="input-select"
                    value={form.theme}
                    onChange={(e) =>
                      setForm({ ...form, theme: e.target.value as 'dark' | 'light' })
                    }
                  >
                    <option value="dark">Obsidian Dark (Cyber Observability)</option>
                    <option value="light">Studio Light (Clean Architectural Space)</option>
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">Canvas Background Matrix</span>
                  <select
                    className="input-select"
                    value={form.gridStyle}
                    onChange={(e) =>
                      setForm({ ...form, gridStyle: e.target.value as 'dots' | 'cross' | 'plain' })
                    }
                  >
                    <option value="dots">Subtle Dot Matrix</option>
                    <option value="cross">Engineering Crosshairs</option>
                    <option value="plain">Clean Solid Blueprint</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="settings-modal-footer">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Reset Defaults
          </Button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave}>
              {savedFeedback ? 'Saved Settings' : 'Apply Configuration'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
