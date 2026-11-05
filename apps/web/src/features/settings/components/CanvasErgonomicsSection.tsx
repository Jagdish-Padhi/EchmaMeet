import type { AppSettings } from '../types';

interface CanvasErgonomicsSectionProps {
  readonly form: AppSettings;
  readonly onChange: (patch: Partial<AppSettings>) => void;
}

export function CanvasErgonomicsSection({ form, onChange }: CanvasErgonomicsSectionProps) {
  return (
    <>
      <section id="sub-visual-theme" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Theme &amp; Blueprint Matrix</h2>
        </div>
        <p className="subsection-desc">
          Select your visual environment, contrast palette, and canvas matrix background.
        </p>

        <div className="settings-form-grid">
          <label className="field-group">
            <span className="field-label">Visual Interface Theme</span>
            <select
              className="input-select"
              value={form.theme}
              onChange={(e) => onChange({ theme: e.target.value as 'dark' | 'light' })}
            >
              <option value="dark">Obsidian Dark (Cyber Observability &amp; SRE)</option>
              <option value="light">Studio Light (Clean Whiteboard &amp; Architecture)</option>
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">Canvas Background Grid Matrix</span>
            <select
              className="input-select"
              value={form.gridStyle}
              onChange={(e) =>
                onChange({
                  gridStyle: e.target.value as 'dots' | 'cross' | 'plain',
                })
              }
            >
              <option value="dots">Subtle Dot Matrix</option>
              <option value="cross">Engineering Crosshairs</option>
              <option value="plain">Solid Clean Blueprint</option>
            </select>
          </label>
        </div>
      </section>

      <section id="sub-canvas-interactions" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Spatial Ergonomics &amp; Blast Radius</h2>
        </div>
        <p className="subsection-desc">
          Node interaction behavior, alignment grids, and live telemetry badges.
        </p>

        <div className="toggle-cards-column">
          <label className="toggle-card">
            <div className="toggle-card-content">
              <span className="toggle-card-title">Auto-Snap Nodes to 20px Grid</span>
              <span className="toggle-card-desc">
                Automatically aligns services neatly on release for clean system diagrams.
              </span>
            </div>
            <input
              type="checkbox"
              className="toggle-switch-checkbox"
              checked={form.snapToGrid}
              onChange={(e) => onChange({ snapToGrid: e.target.checked })}
            />
          </label>

          <label className="toggle-card">
            <div className="toggle-card-content">
              <span className="toggle-card-title">Live Telemetry Badges on Canvas Nodes</span>
              <span className="toggle-card-desc">
                Shows instantaneous RPS and error counts directly overlaid on active node pills.
              </span>
            </div>
            <input
              type="checkbox"
              className="toggle-switch-checkbox"
              checked={form.showLiveTelemetryBadges}
              onChange={(e) => onChange({ showLiveTelemetryBadges: e.target.checked })}
            />
          </label>

          <label className="toggle-card">
            <div className="toggle-card-content">
              <span className="toggle-card-title">Highlight Downstream Blast Radius</span>
              <span className="toggle-card-desc">
                Hovering over a node visually glows all dependent downstream microservices.
              </span>
            </div>
            <input
              type="checkbox"
              className="toggle-switch-checkbox"
              checked={form.highlightBlastRadius}
              onChange={(e) => onChange({ highlightBlastRadius: e.target.checked })}
            />
          </label>
        </div>
      </section>

      <section id="sub-vision-gestures" className="settings-card-subsection">
        <div className="subsection-header">
          <h2 className="subsection-title">Multimodal Vision &amp; SAM 3.1 Thresholds</h2>
        </div>
        <p className="subsection-desc">
          Controls Segment Anything Model (SAM 3.1) red-stroke pen gesture sensitivity.
        </p>

        <div className="slider-group">
          <div className="slider-header">
            <span className="slider-label">Gesture Confidence Threshold:</span>
            <span className="slider-value-badge">{form.visionConfidenceThreshold}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={95}
            step={5}
            className="input-range-slider"
            value={form.visionConfidenceThreshold}
            onChange={(e) => onChange({ visionConfidenceThreshold: parseInt(e.target.value, 10) })}
          />
          <div className="slider-bounds">
            <span>50% (Permissive / Rough pen)</span>
            <span>75% (Recommended)</span>
            <span>95% (Strict precision)</span>
          </div>
        </div>
      </section>
    </>
  );
}
