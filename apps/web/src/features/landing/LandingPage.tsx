import type { ScenarioSpec } from '@chaosboard/contracts';

export interface LandingPageProps {
  readonly onLaunchStudio: (scenarioId?: string) => void;
  readonly scenarios: readonly ScenarioSpec[];
  readonly theme: 'dark' | 'light';
  readonly onToggleTheme: () => void;
  readonly onOpenSettings: () => void;
}

export function LandingPage({
  onLaunchStudio,
  scenarios,
  theme,
  onToggleTheme,
  onOpenSettings,
}: LandingPageProps) {
  return (
    <div className="landing-page-root">
      {/* Deep Ambient Reflection & Mesh Glow */}
      <div className="landing-ambient-glow" aria-hidden="true" />

      {/* Landing Navigation Header */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-brand">
            <div className="brand-emblem" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
                <polygon
                  points="16,3 29,10 29,24 16,30 3,24 3,10"
                  stroke="#0866ff"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                <circle cx="16" cy="16.5" r="4" fill="#0866ff" />
                <circle
                  cx="16"
                  cy="16.5"
                  r="7.5"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
              </svg>
            </div>
            <div className="brand-title-wrap">
              <span className="landing-title">Resilio</span>
            </div>
          </div>

          <nav className="landing-nav-links" aria-label="Landing page navigation">
            <a href="#overview">Overview</a>
            <a href="#canvas">Interactive Review</a>
            <a href="#pillars">Capabilities</a>
            <a href="#scenarios">Scenarios</a>
          </nav>

          <div className="landing-header-actions">
            <button
              type="button"
              className="btn-icon-toggle"
              onClick={onToggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
              aria-label="Toggle visual theme"
            >
              {theme === 'dark' ? (
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              className="btn-icon-toggle"
              onClick={onOpenSettings}
              title="System Settings"
              aria-label="Open settings"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            <button type="button" className="btn btn-primary" onClick={() => onLaunchStudio()}>
              Launch Studio &rarr;
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section with Deep Glow */}
      <section id="overview" className="landing-hero">
        <div className="hero-content">
          <h1 className="hero-headline">
            Distributed Systems Architecture.
            <br />
            <span className="hero-headline-gradient">Verified with Real Chaos.</span>
          </h1>

          <p className="hero-subhead">
            Draw or import microservice topologies, simulate physical network failures, and let Meta
            AI agents prove resilience before deployment.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-primary btn-hero"
              onClick={() => onLaunchStudio()}
            >
              Launch Studio &rarr;
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-hero"
              onClick={() => onLaunchStudio(scenarios[0]?.id ?? 'retry-storm')}
            >
              Simulate Retry Storm
            </button>
          </div>

          {/* Interactive Hero Visual Showcase: Breakscale / Excalidraw Style Preview */}
          <div id="canvas" className="hero-canvas-preview">
            <div className="preview-window-bar">
              <div className="preview-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>
              <div className="preview-room-title">
                <span className="room-indicator" />
                <span>#rfc-checkout-v2 &bull; Architecture Review Session</span>
              </div>
              <div className="preview-presence">
                <span className="avatar avatar-ai">Meta AI</span>
              </div>
            </div>

            <div className="preview-canvas-viewport">
              {/* Simulated Topology Graph */}
              <svg className="preview-svg" viewBox="0 0 880 340">
                <defs>
                  <pattern id="preview-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="rgba(255, 255, 255, 0.08)" />
                  </pattern>
                  <marker
                    id="p-arrow"
                    viewBox="0 0 10 10"
                    refX="7.5"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1.5 L 7.5 5 L 0 8.5 Z" fill="#64748b" />
                  </marker>
                </defs>

                <rect width="100%" height="100%" fill="url(#preview-grid)" />

                {/* Wire 1: Gateway -> Auth */}
                <path
                  d="M 234 118 L 307 118 Q 307 118, 307 118 L 380 118"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  markerEnd="url(#p-arrow)"
                />
                <circle r="3" fill="#38bdf8">
                  <animateMotion path="M 234 118 L 380 118" dur="1.8s" repeatCount="indefinite" />
                </circle>

                {/* Wire 2: Gateway -> Order Svc (Orthogonal elbow bend) */}
                <path
                  d="M 234 118 L 293 118 Q 307 118, 307 132 L 307 224 Q 307 238, 321 238 L 380 238"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="1.8"
                  markerEnd="url(#p-arrow)"
                />
                <circle r="3" fill="#38bdf8">
                  <animateMotion
                    path="M 234 118 L 293 118 Q 307 118, 307 132 L 307 224 Q 307 238, 321 238 L 380 238"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Wire 3: Order Svc -> Ledger Sink */}
                <path
                  d="M 564 238 L 680 238"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  markerEnd="url(#p-arrow)"
                />
                <circle r="3" fill="#10b981">
                  <animateMotion path="M 564 238 L 680 238" dur="1.6s" repeatCount="indefinite" />
                </circle>

                {/* Node 1: API Gateway */}
                <g transform="translate(50, 80)">
                  <rect
                    width="184"
                    height="76"
                    rx="10"
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />
                  <rect
                    x="12"
                    y="12"
                    width="28"
                    height="28"
                    rx="6"
                    fill="rgba(56, 189, 248, 0.12)"
                  />
                  <text x="48" y="26" fill="#f8fafc" fontSize="13" fontWeight="600">
                    API Gateway
                  </text>
                  <text
                    x="48"
                    y="38"
                    fill="#38bdf8"
                    fontSize="9.5"
                    fontFamily="var(--font-mono)"
                    fontWeight="700"
                  >
                    SERVICE &bull; ENTRY
                  </text>
                  <text x="14" y="64" fill="#64748b" fontSize="10.5" fontFamily="var(--font-mono)">
                    20w &bull; 10ms &bull; bounded
                  </text>
                </g>

                {/* Node 2: Auth Service (Flagged Hazard) */}
                <g transform="translate(380, 80)">
                  <rect
                    x="-3"
                    y="-3"
                    width="190"
                    height="82"
                    rx="12"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    className="hazard-pulse-ring"
                  />
                  <rect
                    width="184"
                    height="76"
                    rx="10"
                    fill="#0f172a"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                  />
                  <rect
                    x="12"
                    y="12"
                    width="28"
                    height="28"
                    rx="6"
                    fill="rgba(245, 158, 11, 0.12)"
                  />
                  <text x="48" y="26" fill="#f8fafc" fontSize="13" fontWeight="600">
                    Auth Service
                  </text>
                  <text
                    x="48"
                    y="38"
                    fill="#f59e0b"
                    fontSize="9.5"
                    fontFamily="var(--font-mono)"
                    fontWeight="700"
                  >
                    SERVICE &bull; HAZARD
                  </text>
                  <text x="14" y="64" fill="#64748b" fontSize="10.5" fontFamily="var(--font-mono)">
                    10w &bull; 15ms &bull; bounded
                  </text>
                </g>

                {/* Node 3: Order Svc */}
                <g transform="translate(380, 200)">
                  <rect
                    width="184"
                    height="76"
                    rx="10"
                    fill="#0f172a"
                    stroke="#334155"
                    strokeWidth="1.25"
                  />
                  <rect
                    x="12"
                    y="12"
                    width="28"
                    height="28"
                    rx="6"
                    fill="rgba(37, 99, 235, 0.14)"
                  />
                  <text x="48" y="26" fill="#f8fafc" fontSize="13" fontWeight="600">
                    Order Processor
                  </text>
                  <text
                    x="48"
                    y="38"
                    fill="#3b82f6"
                    fontSize="9.5"
                    fontFamily="var(--font-mono)"
                    fontWeight="700"
                  >
                    QUEUE WORKER
                  </text>
                  <text x="14" y="64" fill="#64748b" fontSize="10.5" fontFamily="var(--font-mono)">
                    15w &bull; 25ms &bull; bounded
                  </text>
                </g>

                {/* Node 4: Ledger Sink */}
                <g transform="translate(680, 200)">
                  <rect
                    width="184"
                    height="76"
                    rx="10"
                    fill="#0f172a"
                    stroke="#10b981"
                    strokeWidth="1.5"
                  />
                  <rect
                    x="12"
                    y="12"
                    width="28"
                    height="28"
                    rx="6"
                    fill="rgba(16, 185, 129, 0.12)"
                  />
                  <text x="48" y="26" fill="#f8fafc" fontSize="13" fontWeight="600">
                    Financial Ledger
                  </text>
                  <text
                    x="48"
                    y="38"
                    fill="#10b981"
                    fontSize="9.5"
                    fontFamily="var(--font-mono)"
                    fontWeight="700"
                  >
                    LEDGER SINK
                  </text>
                  <text x="14" y="64" fill="#64748b" fontSize="10.5" fontFamily="var(--font-mono)">
                    5w &bull; 50ms &bull; dedupe:true
                  </text>
                </g>
              </svg>

              {/* Floating SRE AI Detection Chip */}
              <div className="preview-ai-card">
                <div className="ai-card-header">
                  <span className="ai-indicator-dot" />
                  <span className="ai-card-title">Meta AI SRE &bull; Retry Storm Risk</span>
                </div>
                <div className="ai-card-desc">
                  Link gateway &rarr; auth lacks backoff jitter. Cascading queue exhaustion
                  detected.
                </div>
                <button
                  type="button"
                  className="btn-ai-action"
                  onClick={() => onLaunchStudio('retry-storm')}
                >
                  Test in Sandbox &rarr;
                </button>
              </div>

              {/* Live Telemetry HUD */}
              <div className="preview-telemetry-hud">
                <span className="hud-metric">
                  <span className="hud-label">p99 Latency</span>
                  <span className="hud-value">142ms</span>
                </span>
                <span className="hud-metric">
                  <span className="hud-label">Error Rate</span>
                  <span className="hud-value green">0.0%</span>
                </span>
                <span className="hud-metric">
                  <span className="hud-label">Throughput</span>
                  <span className="hud-value">420 RPS</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section id="pillars" className="landing-section">
        <div className="section-header">
          <h2 className="section-title">Built for Systems Engineers</h2>
          <p className="section-desc">
            Compile architecture designs into real TCP sockets, inject physical chaos, and verify
            mathematical bounds.
          </p>
        </div>

        <div className="pillars-grid">
          <div className="pillar-card">
            <div className="pillar-icon-box cyan">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
            </div>
            <h3 className="pillar-title">Spatial System Canvas</h3>
            <p className="pillar-desc">
              Compose services, bounded queues, and database sinks with drag-to-connect orthogonal
              wires, hotkey duplication, and live DAG validation.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon-box amber">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <h3 className="pillar-title">Physical Network Chaos</h3>
            <p className="pillar-desc">
              Zero synthetic mocks. Real TCP latency spikes, packet drops, and socket resets
              executed directly via Toxiproxy daemons.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon-box blue">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h3 className="pillar-title">Autonomous Meta AI SRE</h3>
            <p className="pillar-desc">
              Meta Muse Wonder agents monitor review discussions in real time, spot cascading retry
              loops, and synthesize mathematically proven circuit-breaker patches.
            </p>
          </div>
        </div>
      </section>

      {/* Real Outage Scenarios */}
      <section id="scenarios" className="landing-section">
        <div className="section-header">
          <h2 className="section-title">Battle-Tested Failure Modes</h2>
          <p className="section-desc">
            Simulate cascading outages inspired by real hyperscale production incidents.
          </p>
        </div>

        <div className="scenarios-grid">
          {scenarios.map((sc) => (
            <div key={sc.id} className="scenario-card-modern">
              <div className="scenario-header">
                <h3 className="scenario-name">{sc.name}</h3>
                <span className="scenario-nodes-count">
                  {String(sc.topology.nodes.length)} nodes &bull; {String(sc.topology.edges.length)}{' '}
                  links
                </span>
              </div>
              <p className="scenario-description">{sc.description}</p>
              <div className="scenario-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onLaunchStudio(sc.id)}
                >
                  Load Scenario &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Clean Engineering Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span className="footer-title">Resilio</span>
          <span className="footer-copy">
            &copy; 2026 Resilio Systems. Distributed resilience verification sandbox.
          </span>
        </div>
      </footer>
    </div>
  );
}
