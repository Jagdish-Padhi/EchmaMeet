import type { ScenarioSpec } from '@chaosboard/contracts';

export interface LandingPageProps {
  readonly onLaunchStudio: (scenarioId?: string) => void;
  readonly scenarios: readonly ScenarioSpec[];
  readonly theme: 'dark' | 'light';
  readonly onToggleTheme: () => void;
  readonly onOpenSettings: () => void;
  readonly isAuthenticated?: boolean;
  readonly onOpenAuth?: () => void;
}

export function LandingPage({
  onLaunchStudio,
  scenarios,
  theme,
  onToggleTheme,
  onOpenSettings,
  isAuthenticated = false,
  onOpenAuth,
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

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (isAuthenticated) {
                  onLaunchStudio();
                } else if (onOpenAuth) {
                  onOpenAuth();
                } else {
                  onLaunchStudio();
                }
              }}
            >
              {isAuthenticated ? 'Enter Studio \u2192' : 'Sign In / Launch \u2192'}
            </button>
          </div>
        </div>
      </header>

      {/* Unified Cinematic Hero Section */}
      <section id="overview" className="landing-hero-cinematic">
        {/* Atmospheric Background Layer: Architecture Topology (Left) & Meta AI Meeting Review (Right) */}
        <div className="hero-backdrop-layer" aria-hidden="true">
          <svg
            className="hero-backdrop-svg"
            viewBox="0 0 1440 680"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <pattern id="hero-matrix-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="rgba(255, 255, 255, 0.04)" />
              </pattern>

              {/* Smooth linear gradient masks fading graphics towards the center text */}
              <linearGradient id="fade-to-center-left" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                <stop offset="65%" stopColor="#ffffff" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>

              <linearGradient id="fade-to-center-right" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                <stop offset="65%" stopColor="#ffffff" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>

              <mask id="mask-left-graph">
                <rect x="0" y="0" width="800" height="680" fill="url(#fade-to-center-left)" />
              </mask>

              <mask id="mask-right-ai">
                <rect x="640" y="0" width="800" height="680" fill="url(#fade-to-center-right)" />
              </mask>

              <marker
                id="hero-arrow"
                viewBox="0 0 10 10"
                refX="7.5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 7.5 5 L 0 8.5 Z" fill="#475569" />
              </marker>
            </defs>

            <rect width="100%" height="100%" fill="url(#hero-matrix-grid)" />

            {/* LEFT SIDE: Connected Architecture Blocks & Live Stepped Dataflow */}
            <g mask="url(#mask-left-graph)">
              {/* Stepped Link 1: Gateway -> Order API */}
              <path
                d="M 230 190 L 290 190 Q 304 190, 304 204 L 304 296 Q 304 310, 318 310 L 360 310"
                fill="none"
                stroke="#334155"
                strokeWidth="1.8"
                markerEnd="url(#hero-arrow)"
              />
              <circle r="3" fill="#38bdf8">
                <animateMotion
                  path="M 230 190 L 290 190 Q 304 190, 304 204 L 304 296 Q 304 310, 318 310 L 360 310"
                  dur="2.8s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* Stepped Link 2: Gateway -> Auth Cluster */}
              <path
                d="M 230 190 L 290 190 Q 304 190, 304 176 L 304 114 Q 304 100, 318 100 L 360 100"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                markerEnd="url(#hero-arrow)"
              />
              <circle r="3" fill="#38bdf8">
                <animateMotion
                  path="M 230 190 L 290 190 Q 304 190, 304 176 L 304 114 Q 304 100, 318 100 L 360 100"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* Stepped Link 3: Order API Flowing behind center text */}
              <path
                d="M 530 310 L 610 310 Q 624 310, 624 324 L 624 380 Q 624 394, 638 394 L 800 394"
                fill="none"
                stroke="#2563eb"
                strokeWidth="1.8"
                strokeDasharray="5 3"
              />
              <circle r="3" fill="#60a5fa">
                <animateMotion
                  path="M 530 310 L 610 310 Q 624 310, 624 324 L 624 380 Q 624 394, 638 394 L 800 394"
                  dur="3.2s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* Block 1: API Gateway (Left Entry) */}
              <g transform="translate(60, 155)">
                <rect
                  width="170"
                  height="70"
                  rx="8"
                  fill="rgba(14, 18, 28, 0.75)"
                  stroke="rgba(56, 189, 248, 0.35)"
                  strokeWidth="1.2"
                />
                <rect x="12" y="12" width="24" height="24" rx="5" fill="rgba(56, 189, 248, 0.12)" />
                <text x="44" y="24" fill="#f8fafc" fontSize="12" fontWeight="600">
                  API Gateway
                </text>
                <text
                  x="44"
                  y="35"
                  fill="#38bdf8"
                  fontSize="8.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  SERVICE &bull; ENTRY
                </text>
                <text x="14" y="58" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
                  20w &bull; 10ms &bull; bounded
                </text>
              </g>

              {/* Block 2: Auth Cluster (Top Left) */}
              <g transform="translate(360, 65)">
                <rect
                  width="170"
                  height="70"
                  rx="8"
                  fill="rgba(14, 18, 28, 0.75)"
                  stroke="rgba(245, 158, 11, 0.35)"
                  strokeWidth="1.2"
                />
                <rect x="12" y="12" width="24" height="24" rx="5" fill="rgba(245, 158, 11, 0.12)" />
                <text x="44" y="24" fill="#f8fafc" fontSize="12" fontWeight="600">
                  Auth Cluster
                </text>
                <text
                  x="44"
                  y="35"
                  fill="#f59e0b"
                  fontSize="8.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  SERVICE &bull; HAZARD
                </text>
                <text x="14" y="58" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
                  10w &bull; 15ms &bull; retry:3x
                </text>
              </g>

              {/* Block 3: Order Processor (Bottom Left) */}
              <g transform="translate(360, 275)">
                <rect
                  width="170"
                  height="70"
                  rx="8"
                  fill="rgba(14, 18, 28, 0.75)"
                  stroke="rgba(37, 99, 235, 0.35)"
                  strokeWidth="1.2"
                />
                <rect x="12" y="12" width="24" height="24" rx="5" fill="rgba(37, 99, 235, 0.14)" />
                <text x="44" y="24" fill="#f8fafc" fontSize="12" fontWeight="600">
                  Order Processor
                </text>
                <text
                  x="44"
                  y="35"
                  fill="#3b82f6"
                  fontSize="8.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  QUEUE WORKER
                </text>
                <text x="14" y="58" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
                  15w &bull; 25ms &bull; bounded
                </text>
              </g>

              {/* Block 4: Cache Sink (Deep Left Bottom) */}
              <g transform="translate(130, 395)">
                <rect
                  width="170"
                  height="70"
                  rx="8"
                  fill="rgba(14, 18, 28, 0.55)"
                  stroke="rgba(16, 185, 129, 0.25)"
                  strokeWidth="1"
                />
                <text x="44" y="24" fill="#cbd5e1" fontSize="12" fontWeight="600">
                  Redis Cache
                </text>
                <text
                  x="44"
                  y="35"
                  fill="#10b981"
                  fontSize="8.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  CACHE SINK
                </text>
                <text x="14" y="58" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
                  5w &bull; 2ms &bull; write-through
                </text>
              </g>
            </g>

            {/* RIGHT SIDE: Meta AI Thinking Node & Collaborative Review Room */}
            <g mask="url(#mask-right-ai)">
              {/* Telemetry line connecting AI node to Meeting Room */}
              <path
                d="M 1180 200 L 1180 320"
                fill="none"
                stroke="#0866ff"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <circle r="3" fill="#38bdf8">
                <animateMotion path="M 1180 200 L 1180 320" dur="2s" repeatCount="indefinite" />
              </circle>

              {/* Data stream flowing from AI toward center text */}
              <path
                d="M 1040 155 L 940 155 Q 920 155, 920 175 L 920 260 Q 920 280, 900 280 L 740 280"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                opacity="0.6"
              />

              {/* 1. Meta AI Thinking Node (Top Right) */}
              <g transform="translate(1040, 110)">
                <circle
                  cx="45"
                  cy="45"
                  r="44"
                  fill="none"
                  stroke="#0866ff"
                  strokeWidth="1.2"
                  opacity="0.3"
                  className="ai-breath-ring"
                />
                <circle
                  cx="45"
                  cy="45"
                  r="34"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  opacity="0.5"
                  className="ai-breath-ring-inner"
                />

                <rect
                  x="0"
                  y="0"
                  width="280"
                  height="90"
                  rx="10"
                  fill="rgba(14, 18, 28, 0.75)"
                  stroke="rgba(8, 102, 255, 0.4)"
                  strokeWidth="1.2"
                />

                <g transform="translate(20, 25)">
                  <circle cx="20" cy="20" r="18" fill="rgba(8, 102, 255, 0.18)" />
                  <path
                    d="M 12 20 Q 20 12, 28 20 Q 20 28, 12 20 Z"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.8"
                  />
                  <circle cx="20" cy="20" r="3.5" fill="#38bdf8" />
                </g>

                <text x="68" y="34" fill="#f8fafc" fontSize="13" fontWeight="700">
                  Meta AI SRE
                </text>
                <text
                  x="68"
                  y="48"
                  fill="#38bdf8"
                  fontSize="9.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  MUSE WONDER &bull; LIVE REASONING
                </text>
                <text x="68" y="68" fill="#94a3b8" fontSize="10.5">
                  Real-time blast radius inference
                </text>
              </g>

              {/* 2. Collaborative Meeting Environment (Bottom Right) */}
              <g transform="translate(1040, 320)">
                <rect
                  width="280"
                  height="150"
                  rx="10"
                  fill="rgba(14, 18, 28, 0.75)"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="1.2"
                />

                {/* Meeting Room Header */}
                <rect x="14" y="14" width="8" height="8" rx="4" fill="#10b981" />
                <text x="28" y="21" fill="#e2e8f0" fontSize="11" fontWeight="600">
                  #arch-review &bull; Live Room
                </text>
                <text x="186" y="21" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
                  3 ENGINEERS
                </text>

                <line
                  x1="14"
                  y1="34"
                  x2="266"
                  y2="34"
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeWidth="1"
                />

                {/* Attendee 1 */}
                <g transform="translate(14, 46)">
                  <circle
                    cx="12"
                    cy="12"
                    r="12"
                    fill="#1e293b"
                    stroke="#38bdf8"
                    strokeWidth="1.2"
                  />
                  <text
                    x="12"
                    y="15.5"
                    fill="#38bdf8"
                    fontSize="9.5"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    SC
                  </text>
                  <text x="32" y="12" fill="#f1f5f9" fontSize="11" fontWeight="600">
                    Sarah C.
                  </text>
                  <text x="32" y="23" fill="#64748b" fontSize="9.5">
                    Lead SRE &bull; Speaking
                  </text>
                  <circle cx="240" cy="12" r="3" fill="#10b981" />
                </g>

                {/* Attendee 2 */}
                <g transform="translate(14, 80)">
                  <circle
                    cx="12"
                    cy="12"
                    r="12"
                    fill="#1e293b"
                    stroke="rgba(255, 255, 255, 0.15)"
                    strokeWidth="1"
                  />
                  <text
                    x="12"
                    y="15.5"
                    fill="#94a3b8"
                    fontSize="9.5"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    AM
                  </text>
                  <text x="32" y="12" fill="#f1f5f9" fontSize="11" fontWeight="600">
                    Alex M.
                  </text>
                  <text x="32" y="23" fill="#64748b" fontSize="9.5">
                    Platform Staff
                  </text>
                </g>

                {/* Attendee 3 */}
                <g transform="translate(14, 114)">
                  <circle
                    cx="12"
                    cy="12"
                    r="12"
                    fill="#1e293b"
                    stroke="rgba(255, 255, 255, 0.15)"
                    strokeWidth="1"
                  />
                  <text
                    x="12"
                    y="15.5"
                    fill="#94a3b8"
                    fontSize="9.5"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    DK
                  </text>
                  <text x="32" y="12" fill="#f1f5f9" fontSize="11" fontWeight="600">
                    Devon K.
                  </text>
                  <text x="32" y="23" fill="#64748b" fontSize="9.5">
                    Security Architect
                  </text>
                </g>
              </g>
            </g>
          </svg>
        </div>

        {/* Center Hero Content (Prominent, High Contrast, Centered) */}
        <div className="hero-center-content">
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
              Simulate Live Scenario
            </button>
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
