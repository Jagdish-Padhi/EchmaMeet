import { useState } from 'react';
import type { ScenarioSpec } from '@chaosboard/contracts';

export interface LandingPageProps {
  readonly onLaunchStudio: (scenarioId?: string) => void;
  readonly scenarios: readonly ScenarioSpec[];
  readonly theme: 'dark' | 'light';
  readonly onToggleTheme: () => void;
  readonly onOpenSettings: () => void;
  readonly isAuthenticated?: boolean;
  readonly onOpenAuth?: (mode?: 'login' | 'signup') => void;
}

interface FaqItem {
  readonly question: string;
  readonly answer: string;
  readonly category: string;
}

const FAQ_ITEMS: readonly FaqItem[] = [
  {
    category: 'Architecture & Engine',
    question: 'How does Resilio differ from tools like Miro, Lucidchart, or Draw.io?',
    answer:
      'Static diagramming tools store passive vector shapes that quickly become obsolete documentation. Resilio is the first executable architecture canvas. When you connect microservices, message queues, and databases on Resilio, the canvas compiles into a live distributed DAG backed by real network properties (timeouts, concurrency limits, buffer depths). You can inject physical network chaos and prove whether your architecture survives before writing production code.',
  },
  {
    category: 'Deployment & Setup',
    question: 'Do I need to install Docker or run heavy local containers?',
    answer:
      'No. Resilio runs directly in any modern browser without requiring local Docker daemons, Minikube, or heavy container runtimes. The execution engine communicates with sandboxed background Toxiproxy processes and high-throughput traffic generators that emulate real TCP/UDP sockets and packet drops with minimal memory overhead.',
  },
  {
    category: 'AI & Invariant Verification',
    question: 'How does the autonomous Meta AI SRE agent analyze our architecture?',
    answer:
      'The Meta AI SRE agent analyzes your live DAG topology, real-time telemetry metrics (p95/p99 latency, queue depth, error rates), and team conversation in meeting rooms. It detects subtle failure patterns like retry storms, cascade timeouts, and buffer bloat under load. It then synthesizes mathematically verified circuit-breaker parameters and explains the blast radius reduction to the team.',
  },
  {
    category: 'Code & Infra Synchronization',
    question: 'Can we export our verified architecture directly to infrastructure code?',
    answer:
      'Yes. Once your topology passes all resilience invariants under chaos injection, you can export it directly as production-ready HashiCorp Terraform modules, Envoy Proxy envoy.yaml filters, Kubernetes manifests, and Docker Compose files. This eliminates documentation drift and ensures your production infrastructure matches your verified design.',
  },
  {
    category: 'Chaos Simulation',
    question: 'What specific network chaos faults can we inject on the canvas?',
    answer:
      'Resilio integrates native Toxiproxy daemons to execute real kernel-level packet latency (with normal, uniform, or Pareto jitter distributions), packet loss percentages, bandwidth throttling (simulating cross-region network degradation), and abrupt TCP socket terminations (simulating sudden node crashes or cloud availability zone failures).',
  },
  {
    category: 'Security & Privacy',
    question: 'Is our proprietary architecture data kept private and secure?',
    answer:
      'Security is built into every layer. Resilio encrypts all topology DAGs, node configurations, and network telemetry in transit (TLS 1.3) and at rest (AES-256). Enterprise plans support dedicated private VPC deployments or air-gapped on-premises installations with SAML 2.0 / Okta SSO authentication and zero external telemetry egress.',
  },
];

export function LandingPage({
  onLaunchStudio,
  scenarios,
  theme,
  onToggleTheme,
  onOpenSettings,
  isAuthenticated = false,
  onOpenAuth,
}: LandingPageProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index));
  };

  const handleAuthAction = (mode: 'login' | 'signup') => {
    if (onOpenAuth) {
      onOpenAuth(mode);
    } else {
      onLaunchStudio();
    }
  };

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
              <span className="landing-badge-enterprise">ENTERPRISE</span>
            </div>
          </div>

          <nav className="landing-nav-links" aria-label="Landing page navigation">
            <a href="#product">Product</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#benefits">Why Resilio</a>
            <a href="#scenarios">Scenarios</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
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

            {isAuthenticated && (
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
            )}

            {isAuthenticated ? (
              <button type="button" className="btn btn-primary" onClick={() => onLaunchStudio()}>
                Enter Studio &rarr;
              </button>
            ) : (
              <div className="landing-auth-btn-group">
                <button
                  type="button"
                  className="landing-login-btn"
                  onClick={() => handleAuthAction('login')}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleAuthAction('signup')}
                >
                  Sign Up &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Cinematic Hero Section */}
      <section id="hero" className="landing-hero-cinematic">
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

              {/* Block 1: API Gateway */}
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

              {/* Block 2: Auth Cluster */}
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

              {/* Block 3: Order Processor */}
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

              {/* Block 4: Cache Sink */}
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

              <path
                d="M 1040 155 L 940 155 Q 920 155, 920 175 L 920 260 Q 920 280, 900 280 L 740 280"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                opacity="0.6"
              />

              {/* Meta AI Node */}
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

              {/* Meeting Room */}
              <g transform="translate(1040, 320)">
                <rect
                  width="280"
                  height="150"
                  rx="10"
                  fill="rgba(14, 18, 28, 0.75)"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="1.2"
                />

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

        {/* Center Hero Content */}
        <div className="hero-center-content">
          <div className="hero-announcement-pill">
            <span className="pill-dot" />
            <span className="pill-tag">NEW: Resilio 2.0</span>
            <span className="pill-text">Autonomous Meta AI SRE Auto-Repair &amp; Envoy IaC</span>
          </div>

          <h1 className="hero-headline">
            Distributed Systems Architecture.
            <br />
            <span className="hero-headline-gradient">Verified with Real Chaos.</span>
          </h1>

          <p className="hero-subhead">
            Resilio compiles visual whiteboard topologies into live physical network DAGs. Simulate
            Toxiproxy packet faults, prevent cascading retry stampedes, and let autonomous Meta AI
            prove mathematical resilience bounds before you push to production.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-primary btn-hero"
              onClick={() => onLaunchStudio()}
            >
              Launch Free Studio &rarr;
            </button>

            <a href="#how-it-works" className="btn btn-secondary btn-hero">
              How It Works
            </a>
          </div>

          {/* Platform Trust Bar */}
          <div className="hero-trust-bar">
            <span className="trust-label">TRUSTED INTEGRATIONS &amp; CLOUD STANDARDS</span>
            <div className="trust-logos-row">
              <span className="trust-badge">AWS VPC</span>
              <span className="trust-badge">Google Cloud</span>
              <span className="trust-badge">Microsoft Azure</span>
              <span className="trust-badge">Kubernetes</span>
              <span className="trust-badge">Envoy Proxy</span>
              <span className="trust-badge">Apache Kafka</span>
              <span className="trust-badge">Redis</span>
              <span className="trust-badge">Terraform</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: The Product (The Paradigm Shift) */}
      <section id="product" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">THE PARADIGM SHIFT</span>
          <h2 className="section-title">Whiteboards Don't Throw HTTP 503s. Production Does.</h2>
          <p className="section-desc">
            Static diagramming tools like Miro and Lucidchart are passive vector drawings. Resilio
            is the first executable architecture studio where nodes run actual TCP sockets, measure
            real latencies, and expose failure cascades.
          </p>
        </div>

        <div className="comparison-container">
          <div className="comparison-card legacy">
            <div className="comparison-card-header">
              <span className="comparison-tag red">TRADITIONAL DRAWING</span>
              <h3 className="comparison-heading">Static Vector Diagrams</h3>
              <p className="comparison-sub">Miro, Lucidchart, Visio, Draw.io</p>
            </div>
            <ul className="comparison-list">
              <li>
                <span className="comparison-icon red">&times;</span>
                <div>
                  <strong>Zero Runtime Validation:</strong> Boxes and arrows have no concept of
                  thread pool exhaustion, concurrency limits, or backpressure.
                </div>
              </li>
              <li>
                <span className="comparison-icon red">&times;</span>
                <div>
                  <strong>Invisible Cascading Retries:</strong> A 3x retry policy looks safe on a
                  flowchart, but triggers a self-inflicted DDoS on downstream databases.
                </div>
              </li>
              <li>
                <span className="comparison-icon red">&times;</span>
                <div>
                  <strong>Theoretical SLA Guesses:</strong> System availability is calculated from
                  spreadsheet optimism rather than real packet failure telemetry.
                </div>
              </li>
              <li>
                <span className="comparison-icon red">&times;</span>
                <div>
                  <strong>Instant Documentation Drift:</strong> Architecture wikis fall out of sync
                  with deployed Terraform code within days of sprint completion.
                </div>
              </li>
            </ul>
          </div>

          <div className="comparison-card active-resilio">
            <div className="comparison-card-badge">RECOMMENDED FOR ENTERPRISE ARCHITECTURE</div>
            <div className="comparison-card-header">
              <span className="comparison-tag blue">RESILIO EXECUTABLE DAG</span>
              <h3 className="comparison-heading">Live Chaos Verification Studio</h3>
              <p className="comparison-sub">Real Toxiproxy Daemons + Meta AI Reasoner</p>
            </div>
            <ul className="comparison-list">
              <li>
                <span className="comparison-icon green">&#10003;</span>
                <div>
                  <strong>Real Kernel Socket Chaos:</strong> Toxiproxy daemons inject physical
                  millisecond jitter, bandwidth throttling, packet drops, and sudden TCP resets.
                </div>
              </li>
              <li>
                <span className="comparison-icon green">&#10003;</span>
                <div>
                  <strong>Deterministic Invariant Bounds:</strong> Mathematically prove whether p99
                  latency stays under 250ms when a third-party payment partner fails.
                </div>
              </li>
              <li>
                <span className="comparison-icon green">&#10003;</span>
                <div>
                  <strong>Autonomous Meta AI SRE:</strong> AI monitors live topology telemetry,
                  detects unbounded queues, and recommends adaptive circuit breaker thresholds.
                </div>
              </li>
              <li>
                <span className="comparison-icon green">&#10003;</span>
                <div>
                  <strong>One-Click Production IaC Export:</strong> Export verified topologies
                  directly into production-ready Terraform modules and Envoy Proxy configs.
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Enterprise Metrics Bar */}
        <div className="metrics-banner">
          <div className="metric-cell">
            <span className="metric-number">$2.4M</span>
            <span className="metric-label">Avg P0 Outage Loss Prevented</span>
          </div>
          <div className="metric-cell">
            <span className="metric-number">4.8x</span>
            <span className="metric-label">Faster Architecture Reviews</span>
          </div>
          <div className="metric-cell">
            <span className="metric-number">100%</span>
            <span className="metric-label">Deterministic Invariant Proofs</span>
          </div>
          <div className="metric-cell">
            <span className="metric-number">0</span>
            <span className="metric-label">Production Blast Risk</span>
          </div>
        </div>
      </section>

      {/* SECTION 2: How It Works */}
      <section id="how-it-works" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">VERIFICATION PIPELINE</span>
          <h2 className="section-title">How Resilio Works in 3 Steps</h2>
          <p className="section-desc">
            A continuous resilience workflow designed for distributed systems architects, platform
            squads, and Site Reliability Engineers.
          </p>
        </div>

        <div className="steps-pipeline-grid">
          <div className="step-card">
            <div className="step-badge">STEP 01</div>
            <div className="step-icon-wrap cyan">
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <h3 className="step-title">Compose or Ingest Topology</h3>
            <p className="step-desc">
              Assemble microservices, API gateways, bounded queues, Redis caches, and sharded
              databases using spatial magnetic routing. Or import existing Docker Compose setups.
            </p>
            <div className="step-tags">
              <span>Docker Ingest</span>
              <span>Orthogonal Routing</span>
              <span>DAG Linter</span>
            </div>
          </div>

          <div className="step-card">
            <div className="step-badge">STEP 02</div>
            <div className="step-icon-wrap amber">
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <h3 className="step-title">Inject Real Physical Chaos</h3>
            <p className="step-desc">
              Execute kernel-level network fault injections via embedded Toxiproxy daemons. Induce
              cross-AZ latency spikes, flaky downstream links, packet loss, and socket drops.
            </p>
            <div className="step-tags">
              <span>Toxiproxy Core</span>
              <span>Packet Loss &amp; Jitter</span>
              <span>TCP Socket Cut</span>
            </div>
          </div>

          <div className="step-card">
            <div className="step-badge">STEP 03</div>
            <div className="step-icon-wrap blue">
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h3 className="step-title">Meta AI SRE &amp; IaC Synthesis</h3>
            <p className="step-desc">
              Autonomous Meta AI reasoning agents identify cascading retry storms, synthesize
              adaptive circuit-breaker policies, verify mathematical invariants, and export
              production Terraform.
            </p>
            <div className="step-tags">
              <span>Meta AI Reasoning</span>
              <span>Circuit Breakers</span>
              <span>Terraform &amp; Envoy IaC</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Why Resilio (Enterprise Benefits) */}
      <section id="benefits" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">ENTERPRISE RESILIENCE</span>
          <h2 className="section-title">Built for Mission-Critical Engineering Teams</h2>
          <p className="section-desc">
            Eliminate P0/P1 blind spots before you commit code, open pull requests, or provision
            cloud infrastructure.
          </p>
        </div>

        <div className="bento-grid">
          <div className="bento-card bento-span-2">
            <div className="bento-header">
              <div className="bento-icon cyan">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 className="bento-title">Zero-Production-Risk Chaos Engineering</h3>
            </div>
            <p className="bento-desc">
              Chaos engineering in production risks customer revenue, data corruption, and SLA
              fines. Resilio provides an isolated pre-production verification sandbox where teams
              can safely simulate split-brain scenarios, database failover lags, and cascading
              timeouts.
            </p>
            <div className="bento-callout">
              <span className="callout-label">INVARIANT VERIFICATION:</span>
              <code>assert p99_latency &lt; 250ms under 40% downstream packet drop</code>
            </div>
          </div>

          <div className="bento-card">
            <div className="bento-header">
              <div className="bento-icon amber">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="bento-title">Collaborative Review Rooms</h3>
            </div>
            <p className="bento-desc">
              Conduct weekly architecture reviews in multi-user live rooms. Push-to-talk voice
              coordination, simultaneous cursor pointers, and collaborative chaos slider
              manipulation.
            </p>
          </div>

          <div className="bento-card">
            <div className="bento-header">
              <div className="bento-icon blue">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 14 14" />
                </svg>
              </div>
              <h3 className="bento-title">Deterministic Invariant Proofs</h3>
            </div>
            <p className="bento-desc">
              Define strict SLA mathematical invariants. Resilio runs automated trials under
              randomized workload surges to empirically prove whether your architecture holds.
            </p>
          </div>

          <div className="bento-card bento-span-2">
            <div className="bento-header">
              <div className="bento-icon green">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h3 className="bento-title">Bi-Directional Infrastructure as Code</h3>
            </div>
            <p className="bento-desc">
              Eliminate drift between architecture diagrams and reality. Export verified
              architectures into production-ready HashiCorp Terraform modules, Envoy Proxy
              envoy.yaml filters, and Kubernetes deployment descriptors in seconds.
            </p>
            <div className="bento-callout">
              <span className="callout-label">SUPPORTED FORMATS:</span>
              <span>
                HashiCorp Terraform (.tf) &bull; Envoy Proxy YAML &bull; Kubernetes Manifests &bull;
                JSON DAG
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Real Failure Scenarios */}
      <section id="scenarios" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">INCIDENT PLAYBOOK</span>
          <h2 className="section-title">Battle-Tested Failure Modes</h2>
          <p className="section-desc">
            Explore and simulate notorious cascading failure patterns modeled after real-world
            outages at hyperscale cloud platforms.
          </p>
        </div>

        <div className="scenarios-grid">
          {scenarios.map((sc) => (
            <div key={sc.id} className="scenario-card-modern">
              <div className="scenario-header">
                <div>
                  <h3 className="scenario-name">{sc.name}</h3>
                  <span className="scenario-nodes-count">
                    {String(sc.topology.nodes.length)} nodes &bull;{' '}
                    {String(sc.topology.edges.length)} links
                  </span>
                </div>
                <span className="scenario-type-pill">CHAOS TEMPLATE</span>
              </div>
              <p className="scenario-description">{sc.description}</p>
              <div className="scenario-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onLaunchStudio(sc.id)}
                >
                  Simulate in Studio &rarr;
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 5: Transparent Pricing */}
      <section id="pricing" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">TRANSPARENT PRICING</span>
          <h2 className="section-title">Predictable Plans for Engineering Teams</h2>
          <p className="section-desc">
            Start free in your browser with zero installation. Scale seamlessly to enterprise
            private VPC clusters.
          </p>

          {/* Billing Cycle Switcher */}
          <div className="billing-switcher-wrap">
            <button
              type="button"
              className={`billing-cycle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              className={`billing-cycle-btn ${billingCycle === 'annual' ? 'active' : ''}`}
              onClick={() => setBillingCycle('annual')}
            >
              Annual Billing
              <span className="annual-save-badge">SAVE 20%</span>
            </button>
          </div>
        </div>

        <div className="pricing-grid">
          {/* Plan 1: Developer */}
          <div className="pricing-card">
            <div className="pricing-tier-header">
              <span className="pricing-tier-badge">COMMUNITY</span>
              <h3 className="pricing-tier-title">Developer</h3>
              <p className="pricing-tier-desc">
                For individual systems engineers and architects exploring chaos-driven design.
              </p>
            </div>

            <div className="pricing-amount-wrap">
              <span className="pricing-amount">$0</span>
              <span className="pricing-period">/ forever</span>
            </div>

            <button
              type="button"
              className="btn btn-secondary pricing-action-btn"
              onClick={() => handleAuthAction('signup')}
            >
              Start Free &rarr;
            </button>

            <div className="pricing-features-list">
              <span className="pricing-feature-header">INCLUDED CAPABILITIES:</span>
              <ul>
                <li>
                  <span>&#10003;</span> Up to 15 nodes per topology canvas
                </li>
                <li>
                  <span>&#10003;</span> Real-time Toxiproxy latency &amp; jitter injection
                </li>
                <li>
                  <span>&#10003;</span> 6 battle-tested failure mode templates
                </li>
                <li>
                  <span>&#10003;</span> JSON topology import and export
                </li>
                <li>
                  <span>&#10003;</span> Dark and light theme support
                </li>
                <li>
                  <span>&#10003;</span> Community Discord support
                </li>
              </ul>
            </div>
          </div>

          {/* Plan 2: Team Pro (Highlighted) */}
          <div className="pricing-card featured-pro">
            <div className="popular-glow-badge">MOST POPULAR</div>
            <div className="pricing-tier-header">
              <span className="pricing-tier-badge pro">TEAM PRO</span>
              <h3 className="pricing-tier-title">Team Pro</h3>
              <p className="pricing-tier-desc">
                For engineering squads conducting weekly architecture reviews and resilience audits.
              </p>
            </div>

            <div className="pricing-amount-wrap">
              <span className="pricing-amount">{billingCycle === 'annual' ? '$39' : '$49'}</span>
              <span className="pricing-period">/ user / mo</span>
              {billingCycle === 'annual' && (
                <span className="pricing-billed-note">billed annually ($468/yr)</span>
              )}
            </div>

            <button
              type="button"
              className="btn btn-primary pricing-action-btn"
              onClick={() => handleAuthAction('signup')}
            >
              Start 14-Day Free Trial &rarr;
            </button>

            <div className="pricing-features-list">
              <span className="pricing-feature-header">EVERYTHING IN DEVELOPER, PLUS:</span>
              <ul>
                <li>
                  <span>&#10003;</span> Unlimited topology nodes and connections
                </li>
                <li>
                  <span>&#10003;</span> Real-time collaborative meeting rooms with voice
                  push-to-talk
                </li>
                <li>
                  <span>&#10003;</span> Autonomous Meta AI SRE invariant verification
                </li>
                <li>
                  <span>&#10003;</span> Terraform and Envoy Proxy IaC generation
                </li>
                <li>
                  <span>&#10003;</span> Advanced chaos: packet drop, socket reset, bandwidth limit
                </li>
                <li>
                  <span>&#10003;</span> Scenario snapshots and version history
                </li>
                <li>
                  <span>&#10003;</span> Priority Slack and email support
                </li>
              </ul>
            </div>
          </div>

          {/* Plan 3: Enterprise */}
          <div className="pricing-card">
            <div className="pricing-tier-header">
              <span className="pricing-tier-badge">ENTERPRISE</span>
              <h3 className="pricing-tier-title">Enterprise</h3>
              <p className="pricing-tier-desc">
                For high-scale organizations demanding private VPCs, SSO, and compliance.
              </p>
            </div>

            <div className="pricing-amount-wrap">
              <span className="pricing-amount">Custom</span>
              <span className="pricing-period">/ annual contract</span>
            </div>

            <button
              type="button"
              className="btn btn-secondary pricing-action-btn"
              onClick={() => handleAuthAction('signup')}
            >
              Contact Enterprise Sales &rarr;
            </button>

            <div className="pricing-features-list">
              <span className="pricing-feature-header">MISSION-CRITICAL CAPABILITIES:</span>
              <ul>
                <li>
                  <span>&#10003;</span> Dedicated private cloud VPC or on-prem air-gapped deployment
                </li>
                <li>
                  <span>&#10003;</span> SAML 2.0 / Okta / Azure AD SSO &amp; directory sync
                </li>
                <li>
                  <span>&#10003;</span> Custom Toxiproxy daemon plugin integrations
                </li>
                <li>
                  <span>&#10003;</span> SOC-2 Type II audit report &amp; enterprise BAA
                </li>
                <li>
                  <span>&#10003;</span> 99.99% uptime SLA &amp; dedicated technical account manager
                </li>
                <li>
                  <span>&#10003;</span> Role-based workspace permissions &amp; audit log export
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: Interactive FAQ Accordion */}
      <section id="faq" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">FREQUENTLY ASKED QUESTIONS</span>
          <h2 className="section-title">Everything You Need to Know</h2>
          <p className="section-desc">
            Common questions about Resilio architecture canvases, Toxiproxy chaos injection, and
            enterprise deployment.
          </p>
        </div>

        <div className="faq-accordion-wrap">
          {FAQ_ITEMS.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div
                key={faq.question}
                className={`faq-item ${isOpen ? 'open' : ''}`}
                onClick={() => toggleFaq(index)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleFaq(index);
                  }
                }}
                aria-expanded={isOpen}
              >
                <div className="faq-question-row">
                  <div className="faq-question-text">
                    <span className="faq-category">{faq.category}</span>
                    <h3 className="faq-title">{faq.question}</h3>
                  </div>
                  <span className="faq-toggle-icon" aria-hidden="true">
                    {isOpen ? '—' : '+'}
                  </span>
                </div>
                {isOpen && (
                  <div className="faq-answer-row">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 7: Bottom CTA Conversion Banner */}
      <section className="landing-cta-banner-wrap">
        <div className="landing-cta-banner">
          <div className="cta-ambient-glow" aria-hidden="true" />
          <h2 className="cta-banner-title">
            Stop Discovering Architecture Blind Spots in Production.
          </h2>
          <p className="cta-banner-desc">
            Join over 1,200+ forward-thinking engineering teams verifying distributed resilience
            before writing a single line of production code.
          </p>
          <div className="cta-banner-actions">
            <button
              type="button"
              className="btn btn-primary btn-hero"
              onClick={() => onLaunchStudio()}
            >
              Launch Free Studio &rarr;
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-hero"
              onClick={() => handleAuthAction('signup')}
            >
              Create Team Account
            </button>
          </div>
          <div className="cta-sub-assurance">
            <span>Zero credit card required</span>
            <span>&bull;</span>
            <span>Instant browser access</span>
            <span>&bull;</span>
            <span>SOC-2 Type II Certified</span>
          </div>
        </div>
      </section>

      {/* SECTION 8: Enterprise Multi-Column Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="footer-columns-grid">
            {/* Col 1: Brand & Status */}
            <div className="footer-brand-col">
              <div className="landing-brand">
                <div className="brand-emblem" aria-hidden="true">
                  <svg viewBox="0 0 32 32" width="20" height="20" fill="none">
                    <polygon
                      points="16,3 29,10 29,24 16,30 3,24 3,10"
                      stroke="#0866ff"
                      strokeWidth="2.2"
                      strokeLinejoin="round"
                    />
                    <circle cx="16" cy="16.5" r="4" fill="#0866ff" />
                  </svg>
                </div>
                <span className="landing-title">Resilio</span>
              </div>
              <p className="footer-tagline">
                The Executable Architecture &amp; Chaos Engineering Platform.
              </p>
              <div className="footer-system-status">
                <span className="status-dot-active" />
                <span className="status-text">All Systems Operational</span>
              </div>
            </div>

            {/* Col 2: Product */}
            <div className="footer-col">
              <h4 className="footer-col-title">Product</h4>
              <ul className="footer-col-links">
                <li>
                  <a href="#product">Executable DAG Studio</a>
                </li>
                <li>
                  <a href="#how-it-works">Toxiproxy Chaos Engine</a>
                </li>
                <li>
                  <a href="#benefits">Meta AI SRE Agent</a>
                </li>
                <li>
                  <a href="#benefits">Live Review Rooms</a>
                </li>
                <li>
                  <a href="#benefits">Terraform &amp; Envoy IaC</a>
                </li>
                <li>
                  <a href="#scenarios">Incident Scenario Library</a>
                </li>
              </ul>
            </div>

            {/* Col 3: Solutions */}
            <div className="footer-col">
              <h4 className="footer-col-title">Solutions</h4>
              <ul className="footer-col-links">
                <li>
                  <a href="#benefits">Microservice Outage Prevention</a>
                </li>
                <li>
                  <a href="#benefits">Cloud Architecture Review</a>
                </li>
                <li>
                  <a href="#benefits">P0 Disaster Recovery Drills</a>
                </li>
                <li>
                  <a href="#scenarios">Retry Storm Mitigation</a>
                </li>
                <li>
                  <a href="#product">Pre-Production Chaos Engineering</a>
                </li>
              </ul>
            </div>

            {/* Col 4: Resources */}
            <div className="footer-col">
              <h4 className="footer-col-title">Resources</h4>
              <ul className="footer-col-links">
                <li>
                  <a href="#faq">Architecture FAQ</a>
                </li>
                <li>
                  <a href="#scenarios">Hyperscale Failure Modes</a>
                </li>
                <li>
                  <a href="#pricing">Enterprise Pricing</a>
                </li>
                <li>
                  <a href="#how-it-works">Toxiproxy Documentation</a>
                </li>
                <li>
                  <a href="#how-it-works">Envoy Proxy Recipes</a>
                </li>
              </ul>
            </div>

            {/* Col 5: Company & Trust */}
            <div className="footer-col">
              <h4 className="footer-col-title">Trust &amp; Legal</h4>
              <ul className="footer-col-links">
                <li>
                  <a href="#pricing">Security &amp; Privacy</a>
                </li>
                <li>
                  <a href="#pricing">SOC-2 Type II Certified</a>
                </li>
                <li>
                  <a href="#pricing">ISO/IEC 27001</a>
                </li>
                <li>
                  <a href="#pricing">Privacy Policy</a>
                </li>
                <li>
                  <a href="#pricing">Terms of Service</a>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom-bar">
            <span className="footer-copy">
              &copy; 2026 Resilio Technologies Inc. All rights reserved.
            </span>
            <div className="footer-compliance-badges">
              <span>SOC-2 Type II Certified</span>
              <span>&bull;</span>
              <span>ISO 27001 Compliant</span>
              <span>&bull;</span>
              <span>Encrypted TLS 1.3</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
