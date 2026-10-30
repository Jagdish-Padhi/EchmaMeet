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
      {/* Landing Navigation Header */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-brand">
            <div className="brand-emblem" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
                <polygon
                  points="16,3 29,10 29,24 16,30 3,24 3,10"
                  stroke="#38bdf8"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                <circle cx="16" cy="16.5" r="4" fill="#38bdf8" />
                <circle
                  cx="16"
                  cy="16.5"
                  r="7.5"
                  stroke="#818cf8"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
              </svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="landing-title">ChaosBoard</span>
              <span className="hackathon-badge">Meta AI Systems Track</span>
            </div>
          </div>

          <nav className="landing-nav-links" aria-label="Landing page navigation">
            <a href="#overview">Overview</a>
            <a href="#workflows">Workflows</a>
            <a href="#scenarios">Scenarios</a>
            <a href="#architecture">Architecture</a>
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
                // Sun icon
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
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                // Moon icon
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
              Launch Architecture Studio &rarr;
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="overview" className="landing-hero">
        <div className="hero-content">
          <div className="hero-pill-tag">
            <span className="hero-pill-dot" />
            <span>Design-Time Chaos Testing &amp; Autonomous Policy Repair</span>
          </div>

          <h1 className="hero-headline">
            Draw a system. Break it on purpose.
            <br />
            <span className="hero-headline-gradient">Measure it. Repair it.</span>
          </h1>

          <p className="hero-subhead">
            ChaosBoard brings chaos engineering into the design phase. Compose microservices on a
            spatial canvas or upload a physical whiteboard photo, inject real Toxiproxy network
            faults over raw TCP sockets, empirically measure latency distributions, and autonomously
            heal resilience policies with Meta open models.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-primary btn-hero"
              onClick={() => onLaunchStudio()}
            >
              Open Architecture Studio &rarr;
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-hero"
              onClick={() => onLaunchStudio(scenarios[0]?.id ?? 'retry-storm')}
            >
              Simulate Retry Storm Scenario
            </button>
          </div>

          {/* Interactive Feature Highlights Bar */}
          <div className="hero-stats-bar">
            <div className="hero-stat-card">
              <span className="hero-stat-value">0</span>
              <span className="hero-stat-label">Mocked Sockets</span>
              <span className="hero-stat-sub">Real Node worker processes over raw TCP</span>
            </div>
            <div className="hero-stat-card">
              <span className="hero-stat-value">100%</span>
              <span className="hero-stat-label">Truthful Metrics</span>
              <span className="hero-stat-sub">
                Medians &amp; IQR from recorded empirical trials
              </span>
            </div>
            <div className="hero-stat-card">
              <span className="hero-stat-value">Meta Spark</span>
              <span className="hero-stat-label">Autonomous Repair</span>
              <span className="hero-stat-sub">Automated Pareto-improving policy patches</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Step Pipeline Showcase */}
      <section id="workflows" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">The ChaosBoard Lifecycle</span>
          <h2 className="section-title">Engineered for Developer Gut &amp; Production Rigor</h2>
          <p className="section-desc">
            From sketch to self-healed microservice architecture in four deterministic, fully
            observable steps.
          </p>
        </div>

        <div className="pipeline-grid">
          <div className="pipeline-card">
            <div className="pipeline-step-badge">STEP 1</div>
            <h3 className="pipeline-title">Spatial Whiteboard &amp; Photo Ingestion</h3>
            <p className="pipeline-desc">
              Draw microservices, queues, and caches directly on an infinite canvas, or snap a photo
              of a whiteboard diagram. SAM 3.1 and internal color-segmentation parse shapes and
              links into a structured acyclic DAG.
            </p>
            <div className="pipeline-tag">Infinite Canvas · Vision Extraction</div>
          </div>

          <div className="pipeline-card">
            <div className="pipeline-step-badge">STEP 2</div>
            <h3 className="pipeline-title">Deterministic Toxiproxy Faults</h3>
            <p className="pipeline-desc">
              Inject real network degradation—latency, jitter, bandwidth throttles, connection
              resets, or TCP stalls—directly via Shopify&apos;s Toxiproxy daemon. Draw a red stroke
              across an edge or speak a voice command to break links.
            </p>
            <div className="pipeline-tag">Red-Stroke Gesture · Push-to-Talk Voice</div>
          </div>

          <div className="pipeline-card">
            <div className="pipeline-step-badge">STEP 3</div>
            <h3 className="pipeline-title">Empirical Invariant Measurement</h3>
            <p className="pipeline-desc">
              Execute multi-trial synthetic workloads comparing baseline and faulted conditions.
              Calculate real Medians and Interquartile Ranges (IQR) for P99 latency and completion
              rates. Zero fabricated numbers.
            </p>
            <div className="pipeline-tag">SQLite WAL Persistence · Live Telemetry</div>
          </div>

          <div className="pipeline-card">
            <div className="pipeline-step-badge">STEP 4</div>
            <h3 className="pipeline-title">Autonomous Meta AI Repair Loop</h3>
            <p className="pipeline-desc">
              The resilience agent proposes token-bucket rate limits, circuit breaker parameters,
              and backoff retries. If a patch regresses latency or error rate, ChaosBoard
              automatically rolls it back until reaching Pareto optimality.
            </p>
            <div className="pipeline-tag">Meta Spark Open · Pareto Frontier</div>
          </div>
        </div>
      </section>

      {/* Benchmark Scenarios Catalog */}
      <section id="scenarios" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">Production Benchmark Suite</span>
          <h2 className="section-title">Pre-Configured Enterprise Failure Scenarios</h2>
          <p className="section-desc">
            Explore classic distributed systems failure modes out of the box with proven baseline
            topologies.
          </p>
        </div>

        <div className="scenarios-showcase-grid">
          {scenarios.map((sc) => (
            <div key={sc.id} className="scenario-showcase-card">
              <div className="scenario-showcase-header">
                <span className="scenario-node-count">
                  {sc.topology.nodes.length} Microservices
                </span>
                <span className="scenario-id-chip">{sc.id}</span>
              </div>
              <h3 className="scenario-showcase-title">{sc.name}</h3>
              <p className="scenario-showcase-desc">{sc.description}</p>
              <div className="scenario-failure-tag">
                <strong>Failure Mode:</strong> {sc.designedFailureMode}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', marginTop: '16px' }}
                onClick={() => onLaunchStudio(sc.id)}
              >
                Load {sc.name} in Studio &rarr;
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Engineering Charter & Principles */}
      <section id="architecture" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">Deep Engineering Charter</span>
          <h2 className="section-title">Built with Zero Compromises</h2>
        </div>

        <div className="charter-grid">
          <div className="charter-box">
            <h4>No Mocked Sockets</h4>
            <p>
              Every node runs in its own worker thread or child process communicating over real
              operating system sockets.
            </p>
          </div>
          <div className="charter-box">
            <h4>Guaranteed Cleanup</h4>
            <p>
              Process registries and signal traps guarantee 100% leak-free teardown of processes,
              sockets, and proxies.
            </p>
          </div>
          <div className="charter-box">
            <h4>Strict Boundary Enforcement</h4>
            <p>
              Domain, application, infrastructure, and contract layers are checked by Dependency
              Cruiser on every commit.
            </p>
          </div>
          <div className="charter-box">
            <h4>Zero Cloud Lock-in</h4>
            <p>
              Runs 100% locally with deterministic rule-based repair, pure-TypeScript image
              processing, and SQLite WAL.
            </p>
          </div>
        </div>
      </section>

      {/* Final Action Banner */}
      <section className="landing-cta-banner">
        <h2>Ready to stress-test your architecture?</h2>
        <p>
          Open the clean canvas studio and start testing resilience before writing production code.
        </p>
        <button type="button" className="btn btn-primary btn-hero" onClick={() => onLaunchStudio()}>
          Enter Architecture Studio &rarr;
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700 }}>ChaosBoard</span>
            <span style={{ color: 'var(--color-text-dim)' }}>&bull;</span>
            <span style={{ color: 'var(--color-text-muted)' }}>MIT Licensed Open Source</span>
          </div>
          <div style={{ color: 'var(--color-text-dim)', fontSize: '12px' }}>
            Built for the Meta AI Systems Track &bull; Node.js v22+
          </div>
        </div>
      </footer>
    </div>
  );
}
