import { useState } from 'react';
import type { ScenarioSpec } from '@chaosboard/contracts';

export interface LandingPageProps {
  readonly onLaunchStudio: (scenarioId?: string) => void;
  readonly scenarios?: readonly ScenarioSpec[];
  readonly theme: 'dark' | 'light';
  readonly onToggleTheme: () => void;
  readonly onOpenSettings: () => void;
  readonly isAuthenticated?: boolean;
  readonly onOpenAuth?: (mode?: 'login' | 'signup') => void;
}

interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: 'How is Resilio different from Miro or Lucidchart?',
    answer:
      'Miro and Lucidchart only draw static shapes. They cannot tell you what happens when a service times out or traffic spikes. Resilio turns your architecture diagram into a live interactive simulation where you can see failure ripple across microservices before writing code.',
  },
  {
    question: 'Do I need to install Docker or run heavy local containers?',
    answer:
      'No. Resilio runs directly in your web browser. There are no heavy containers to manage or complex clusters to configure. You can design and simulate failure in seconds.',
  },
  {
    question: 'How does the AI assistant help during reviews?',
    answer:
      'Meta AI watches your topology metrics during failure simulations. If it detects a risky pattern—like retrying too aggressively or an unbuffered queue—it highlights the risk and suggests exact timeout and circuit-breaker settings to prevent an outage.',
  },
  {
    question: 'Can we export our designs straight to infrastructure code?',
    answer:
      'Yes. Once your architecture passes your resilience checks, you can export it directly into production-ready Terraform modules, Envoy Proxy configs, or Docker Compose manifests.',
  },
  {
    question: 'Is our architecture design private and secure?',
    answer:
      'Yes. All designs are encrypted in transit and at rest. For enterprises with strict compliance needs, Resilio can run entirely inside your private VPC or on-premise air-gapped infrastructure with SSO authentication.',
  },
];

export function LandingPage({
  onLaunchStudio,
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
              <span className="landing-badge-enterprise">STUDIO</span>
            </div>
          </div>

          <nav className="landing-nav-links" aria-label="Landing page navigation">
            <a href="#product">Product</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#benefits">Why Resilio</a>
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

            {/* Left Side: Connected Architecture Graph */}
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
                  ENTRY &bull; 20k req/s
                </text>
                <text x="14" y="58" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
                  p99 &lt; 15ms &bull; normal
                </text>
              </g>

              {/* Block 2: Auth Service */}
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
                  Auth Service
                </text>
                <text
                  x="44"
                  y="35"
                  fill="#f59e0b"
                  fontSize="8.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  CIRCUIT BREAKER ON
                </text>
                <text x="14" y="58" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
                  timeout: 100ms &bull; max: 3
                </text>
              </g>

              {/* Block 3: Order Worker */}
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
                  Order Worker
                </text>
                <text
                  x="44"
                  y="35"
                  fill="#3b82f6"
                  fontSize="8.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  BOUNDED QUEUE
                </text>
                <text x="14" y="58" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
                  depth: 120 / 5000 &bull; safe
                </text>
              </g>
            </g>

            {/* Right Side: Meta AI Assistant & Live Meeting Room */}
            <g mask="url(#mask-right-ai)">
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
                <rect
                  x="0"
                  y="0"
                  width="280"
                  height="84"
                  rx="10"
                  fill="rgba(14, 18, 28, 0.75)"
                  stroke="rgba(8, 102, 255, 0.4)"
                  strokeWidth="1.2"
                />
                <text x="24" y="32" fill="#f8fafc" fontSize="13" fontWeight="700">
                  Meta AI Copilot
                </text>
                <text
                  x="24"
                  y="47"
                  fill="#38bdf8"
                  fontSize="9.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  PREVENTED RETRY STORM
                </text>
                <text x="24" y="66" fill="#94a3b8" fontSize="11">
                  Safe circuit breaker applied to Auth
                </text>
              </g>

              <g transform="translate(1040, 230)">
                <rect
                  width="280"
                  height="110"
                  rx="10"
                  fill="rgba(14, 18, 28, 0.75)"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="1.2"
                />
                <rect x="14" y="14" width="8" height="8" rx="4" fill="#10b981" />
                <text x="28" y="21" fill="#e2e8f0" fontSize="11" fontWeight="600">
                  Team Review Room
                </text>
                <text x="200" y="21" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
                  LIVE AUDIO
                </text>
                <line
                  x1="14"
                  y1="34"
                  x2="266"
                  y2="34"
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeWidth="1"
                />
                <text x="14" y="58" fill="#f1f5f9" fontSize="11" fontWeight="600">
                  Sarah C. &bull; Lead Architect
                </text>
                <text x="14" y="74" fill="#94a3b8" fontSize="10.5">
                  &ldquo;Simulated 200ms lag on Redis. Cache hit fell back safely.&rdquo;
                </text>
              </g>
            </g>
          </svg>
        </div>

        {/* Center Hero Content */}
        <div className="hero-center-content">
          <div className="hero-announcement-pill">
            <span className="pill-dot" />
            <span className="pill-tag">RESILIO 2.0</span>
            <span className="pill-text">Test cloud architecture before you build it</span>
          </div>

          <h1 className="hero-headline">
            Design Your System.
            <br />
            <span className="hero-headline-gradient">Break It Before Production Does.</span>
          </h1>

          <p className="hero-subhead">
            Whiteboard diagrams look great until real traffic hits. Resilio lets you simulate
            latency spikes, server crashes, and retry storms directly on your architecture design—so
            you find breaking points before your users do.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-primary btn-hero"
              onClick={() => onLaunchStudio()}
            >
              Start Free Sandbox &rarr;
            </button>

            <a href="#how-it-works" className="btn btn-secondary btn-hero">
              See How It Works
            </a>
          </div>

          {/* Platform Trust Bar */}
          <div className="hero-trust-bar">
            <span className="trust-label">READY FOR MODERN INFRASTRUCTURE</span>
            <div className="trust-logos-row">
              <span className="trust-badge">AWS</span>
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

      {/* SECTION 1: The Product (The Reality Check) */}
      <section id="product" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">THE REALITY CHECK</span>
          <h2 className="section-title">Static Drawings Don't Crash. Production Does.</h2>
          <p className="section-desc">
            Diagrams in Miro or Lucidchart cannot warn you when a database lag will trigger a
            cascading retry storm. Resilio turns your design into an interactive simulation where
            you can see failures unfold in real time.
          </p>
        </div>

        <div className="comparison-container">
          <div className="comparison-card legacy">
            <div className="comparison-card-header">
              <span className="comparison-tag red">STATIC DRAWINGS</span>
              <h3 className="comparison-heading">Traditional Diagramming</h3>
              <p className="comparison-sub">Miro, Lucidchart, Visio, Draw.io</p>
            </div>
            <ul className="comparison-list">
              <li>
                <span className="comparison-icon red">&times;</span>
                <div>
                  <strong>Dead drawings:</strong> Static boxes cannot tell you if a connection pool
                  will drown under traffic spikes.
                </div>
              </li>
              <li>
                <span className="comparison-icon red">&times;</span>
                <div>
                  <strong>Silent retry traps:</strong> An innocent 3x retry looks fine on paper, but
                  causes an accidental DDoS during an outage.
                </div>
              </li>
              <li>
                <span className="comparison-icon red">&times;</span>
                <div>
                  <strong>Hoping for the best:</strong> Teams only discover architecture blind spots
                  during a stressful 3 AM production page.
                </div>
              </li>
              <li>
                <span className="comparison-icon red">&times;</span>
                <div>
                  <strong>Instant doc drift:</strong> Architecture wikis fall out of date the day
                  after they are drawn.
                </div>
              </li>
            </ul>
          </div>

          <div className="comparison-card active-resilio">
            <div className="comparison-card-badge">THE BETTER WAY</div>
            <div className="comparison-card-header">
              <span className="comparison-tag blue">INTERACTIVE SIMULATION</span>
              <h3 className="comparison-heading">Resilio Design Studio</h3>
              <p className="comparison-sub">Live Network Simulation + AI Copilot</p>
            </div>
            <ul className="comparison-list">
              <li>
                <span className="comparison-icon green">&#10003;</span>
                <div>
                  <strong>Simulate real chaos:</strong> Inject realistic lag, packet loss, and
                  server crashes with a single slider.
                </div>
              </li>
              <li>
                <span className="comparison-icon green">&#10003;</span>
                <div>
                  <strong>See the blast radius:</strong> Watch response times spike across
                  dependencies before writing a single line of code.
                </div>
              </li>
              <li>
                <span className="comparison-icon green">&#10003;</span>
                <div>
                  <strong>Smart AI fixes:</strong> Meta AI spots retry loops and suggests proven
                  timeout and circuit-breaker settings.
                </div>
              </li>
              <li>
                <span className="comparison-icon green">&#10003;</span>
                <div>
                  <strong>Export to code:</strong> Turn your verified architecture straight into
                  production Terraform and Envoy configs.
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Enterprise Metrics Bar */}
        <div className="metrics-banner">
          <div className="metric-cell">
            <span className="metric-number">$2.4M</span>
            <span className="metric-label">Average Cost of a Major Outage</span>
          </div>
          <div className="metric-cell">
            <span className="metric-number">80%</span>
            <span className="metric-label">Outages Caused by Retry Stampedes</span>
          </div>
          <div className="metric-cell">
            <span className="metric-number">10x</span>
            <span className="metric-label">Faster Architecture Alignment</span>
          </div>
          <div className="metric-cell">
            <span className="metric-number">0</span>
            <span className="metric-label">Risk to Production Data</span>
          </div>
        </div>
      </section>

      {/* SECTION 2: How It Works */}
      <section id="how-it-works" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">HOW IT WORKS</span>
          <h2 className="section-title">From Sketch to Resilient System in 3 Steps</h2>
          <p className="section-desc">
            No heavy local containers or complex setup. Everything runs right in your browser.
          </p>
        </div>

        <div className="steps-pipeline-grid">
          <div className="step-card">
            <div className="step-badge">STEP 1</div>
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
            <h3 className="step-title">Draw Your Architecture</h3>
            <p className="step-desc">
              Drag and drop services, caches, queues, and databases onto the canvas. Connect them
              together, or import an existing Docker Compose setup.
            </p>
            <div className="step-tags">
              <span>Drag &amp; Drop</span>
              <span>Docker Import</span>
              <span>Instant Routing</span>
            </div>
          </div>

          <div className="step-card">
            <div className="step-badge">STEP 2</div>
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
            <h3 className="step-title">Break Things on Purpose</h3>
            <p className="step-desc">
              Turn up network lag, cut off third-party APIs, or crash a database node. Watch how the
              rest of your system reacts under pressure.
            </p>
            <div className="step-tags">
              <span>Latency Spikes</span>
              <span>Server Outages</span>
              <span>Packet Drops</span>
            </div>
          </div>

          <div className="step-card">
            <div className="step-badge">STEP 3</div>
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
            <h3 className="step-title">Fix It &amp; Export to Code</h3>
            <p className="step-desc">
              Get smart recommendations for circuit breakers and retry limits. When you're
              confident, export straight to Terraform and Envoy.
            </p>
            <div className="step-tags">
              <span>Meta AI Fixes</span>
              <span>Terraform Export</span>
              <span>Envoy Config</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Why Resilio */}
      <section id="benefits" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">WHY RESILIO</span>
          <h2 className="section-title">Sleep Peacefully on Deploy Day</h2>
          <p className="section-desc">
            Give your team complete clarity on how their distributed architecture will behave when
            things go wrong.
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
              <h3 className="bento-title">Zero Production Risk</h3>
            </div>
            <p className="bento-desc">
              Testing failure in live production is risky and stressful. Resilio gives you a safe
              sandbox to simulate worst-case disasters—database failovers, regional outages, and
              slow APIs—without ever putting real customer revenue in danger.
            </p>
            <div className="bento-callout">
              <span className="callout-label">PEACE OF MIND:</span>
              <span>
                Identify critical failure points long before your code touches a live server.
              </span>
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
              <h3 className="bento-title">Live Team Reviews</h3>
            </div>
            <p className="bento-desc">
              Host architecture review meetings where everyone can interact on the same canvas. Use
              built-in voice chat, draw together, and simulate outages live in front of the team.
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
              <h3 className="bento-title">Catch Retry Storms Early</h3>
            </div>
            <p className="bento-desc">
              Cascading retries are the most common cause of cloud outages. Resilio catches retry
              loops on the whiteboard before they can trigger an accidental DDoS in production.
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
              <h3 className="bento-title">Drawings Become Real Infrastructure</h3>
            </div>
            <p className="bento-desc">
              Stop spending hours manually writing boilerplate config. Once your architecture passes
              simulations, export it directly into HashiCorp Terraform modules and Envoy Proxy
              configurations in seconds.
            </p>
            <div className="bento-callout">
              <span className="callout-label">ONE-CLICK EXPORT:</span>
              <span>
                HashiCorp Terraform (.tf) &bull; Envoy Proxy YAML &bull; Kubernetes Manifests
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Transparent Pricing */}
      <section id="pricing" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">PRICING</span>
          <h2 className="section-title">Simple, Transparent Plans</h2>
          <p className="section-desc">
            Start free in your browser. Upgrade when your team needs collaborative rooms and
            enterprise compliance.
          </p>

          {/* Billing Switcher */}
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
                For individual engineers exploring system resilience and failure simulations.
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
              <span className="pricing-feature-header">INCLUDED:</span>
              <ul>
                <li>
                  <span>&#10003;</span> Up to 15 services per canvas
                </li>
                <li>
                  <span>&#10003;</span> Real-time latency and chaos injection
                </li>
                <li>
                  <span>&#10003;</span> Standard failure simulation templates
                </li>
                <li>
                  <span>&#10003;</span> JSON topology import and export
                </li>
                <li>
                  <span>&#10003;</span> Dark and light theme support
                </li>
                <li>
                  <span>&#10003;</span> Free forever, no credit card required
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
                For engineering squads running weekly design reviews wanting zero outage surprises.
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
                  <span>&#10003;</span> Unlimited services and connections
                </li>
                <li>
                  <span>&#10003;</span> Live collaborative meeting rooms with voice
                </li>
                <li>
                  <span>&#10003;</span> Meta AI automated issue detection &amp; fix suggestions
                </li>
                <li>
                  <span>&#10003;</span> Production Terraform &amp; Envoy IaC export
                </li>
                <li>
                  <span>&#10003;</span> Advanced chaos: packet drops, socket cuts, throttle
                </li>
                <li>
                  <span>&#10003;</span> Version history and scenario snapshots
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
                For high-growth companies needing private clusters, SSO, and compliance.
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
              <span className="pricing-feature-header">ENTERPRISE CAPABILITIES:</span>
              <ul>
                <li>
                  <span>&#10003;</span> Dedicated private cloud VPC or on-prem deployment
                </li>
                <li>
                  <span>&#10003;</span> SAML 2.0 / Okta / Azure AD single sign-on
                </li>
                <li>
                  <span>&#10003;</span> Custom chaos plugins and integrations
                </li>
                <li>
                  <span>&#10003;</span> SOC-2 Type II audit report &amp; Enterprise BAA
                </li>
                <li>
                  <span>&#10003;</span> 99.99% uptime SLA &amp; dedicated technical manager
                </li>
                <li>
                  <span>&#10003;</span> Audit logs &amp; role-based workspace permissions
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: Frequently Asked Questions */}
      <section id="faq" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">QUESTIONS &amp; ANSWERS</span>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-desc">Quick, honest answers to common questions about Resilio.</p>
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

      {/* SECTION 6: Bottom CTA Conversion Banner */}
      <section className="landing-cta-banner-wrap">
        <div className="landing-cta-banner">
          <div className="cta-ambient-glow" aria-hidden="true" />
          <h2 className="cta-banner-title">Stop Discovering Architecture Flaws at 3 AM.</h2>
          <p className="cta-banner-desc">
            Join engineering teams building resilient distributed systems. Test your architecture
            against real failure scenarios today.
          </p>
          <div className="cta-banner-actions">
            <button
              type="button"
              className="btn btn-primary btn-hero"
              onClick={() => onLaunchStudio()}
            >
              Launch Free Sandbox &rarr;
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-hero"
              onClick={() => handleAuthAction('signup')}
            >
              Sign Up for Free
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

      {/* SECTION 7: Enterprise Footer */}
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
                The Interactive Cloud Architecture &amp; Failure Simulation Studio.
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
                  <a href="#product">Design Studio</a>
                </li>
                <li>
                  <a href="#how-it-works">Failure Simulation</a>
                </li>
                <li>
                  <a href="#benefits">Meta AI Copilot</a>
                </li>
                <li>
                  <a href="#benefits">Team Review Rooms</a>
                </li>
                <li>
                  <a href="#benefits">Terraform &amp; Envoy Export</a>
                </li>
              </ul>
            </div>

            {/* Col 3: Solutions */}
            <div className="footer-col">
              <h4 className="footer-col-title">Solutions</h4>
              <ul className="footer-col-links">
                <li>
                  <a href="#benefits">Prevent Outages</a>
                </li>
                <li>
                  <a href="#benefits">Architecture Review</a>
                </li>
                <li>
                  <a href="#benefits">Eliminate Retry Storms</a>
                </li>
                <li>
                  <a href="#product">Pre-Production Testing</a>
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
                  <a href="#pricing">Pricing Plans</a>
                </li>
                <li>
                  <a href="#how-it-works">How It Works</a>
                </li>
                <li>
                  <a href="#product">The Reality Check</a>
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
