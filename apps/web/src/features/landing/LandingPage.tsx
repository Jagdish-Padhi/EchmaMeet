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
    question: 'How does the live review meeting work?',
    answer:
      'Resilio combines high-fidelity architecture design with integrated team audio and multiplayer presence—like Google Meet built directly into a distributed systems whiteboard. Your team jumps on voice, inspects the topology together, and tests failure scenarios collaboratively with zero external meeting software required.',
  },
  {
    question: 'How does the AI SRE agent participate in the meeting?',
    answer:
      'The Meta AI SRE agent acts like a principal reliability engineer sitting in your meeting room. It listens to the discussion context, continuously analyzes live telemetry and dependency graphs in the background, warns the team when someone proposes a risky retry or timeout policy, and drops mathematically verified circuit-breaker fixes directly onto the canvas.',
  },
  {
    question: 'Do we need Docker or heavy local infrastructure?',
    answer:
      'No. Resilio runs completely inside your browser with lightweight background simulation daemons. You do not need to install local Docker containers, Minikube, or heavy cluster runtimes to test complex multi-service topologies.',
  },
  {
    question: 'Can we export our verified meeting designs straight to code?',
    answer:
      'Yes. Once your team and the AI agent agree on the resilient topology, you can export it in one click into production-ready HashiCorp Terraform modules, Envoy Proxy YAML, and Docker Compose files before ending the meeting.',
  },
  {
    question: 'Is our team discussion and architecture private and secure?',
    answer:
      'Yes. All audio streams, node configurations, and topology data are encrypted in transit with TLS 1.3 and at rest with AES-256. For organizations with strict compliance requirements, Resilio can be deployed entirely inside your own private VPC or air-gapped on-premise infrastructure with SAML/SSO authentication.',
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
            </div>
          </div>

          <nav className="landing-nav-links" aria-label="Landing page navigation">
            <a href="#meeting-room">Review Rooms</a>
            <a href="#ai-copilot">AI SRE in Meeting</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#why-switch">Why Resilio</a>
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
                Enter Room &rarr;
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
        {/* Atmospheric Background Layer: Architecture Topology & Live Meeting Room */}
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

            {/* Left Side: Live Distributed Topology */}
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
                  LIVE TRAFFIC STREAM
                </text>
                <text x="14" y="58" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
                  p99: 14ms &bull; 0% loss
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
                  safe timeout: 100ms
                </text>
              </g>

              {/* Block 3: Order Queue */}
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
                  depth: 140 / 5000 &bull; safe
                </text>
              </g>
            </g>

            {/* Right Side: Meta AI Copilot & Live Meeting Room */}
            <g mask="url(#mask-right-ai)">
              {/* AI SRE Agent Node */}
              <g transform="translate(1040, 95)">
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
                  height="90"
                  rx="10"
                  fill="rgba(14, 18, 28, 0.75)"
                  stroke="rgba(8, 102, 255, 0.4)"
                  strokeWidth="1.2"
                />
                <text x="24" y="32" fill="#f8fafc" fontSize="13" fontWeight="700">
                  Meta AI SRE in Call
                </text>
                <text
                  x="24"
                  y="48"
                  fill="#38bdf8"
                  fontSize="9.5"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  ACTIVE MEETING PARTICIPANT
                </text>
                <text x="24" y="70" fill="#94a3b8" fontSize="11">
                  &ldquo;Flagged 3x retry loop on Auth; patch applied.&rdquo;
                </text>
              </g>

              {/* Collaborative Meeting Room */}
              <g transform="translate(1040, 215)">
                <rect
                  width="280"
                  height="145"
                  rx="10"
                  fill="rgba(14, 18, 28, 0.75)"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="1.2"
                />
                <rect x="14" y="14" width="8" height="8" rx="4" fill="#10b981" />
                <text x="28" y="21" fill="#e2e8f0" fontSize="11" fontWeight="600">
                  #arch-review &bull; Live Room
                </text>
                <text x="180" y="21" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
                  VOICE ACTIVE
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
                    cx="10"
                    cy="10"
                    r="10"
                    fill="#1e293b"
                    stroke="#38bdf8"
                    strokeWidth="1.2"
                  />
                  <text
                    x="10"
                    y="13.5"
                    fill="#38bdf8"
                    fontSize="9"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    SC
                  </text>
                  <text x="28" y="11" fill="#f1f5f9" fontSize="11" fontWeight="600">
                    Sarah C. (Staff SRE)
                  </text>
                  <text x="28" y="22" fill="#64748b" fontSize="9.5">
                    Speaking &bull; Simulated 200ms DB lag
                  </text>
                </g>
                <g transform="translate(14, 82)">
                  <circle
                    cx="10"
                    cy="10"
                    r="10"
                    fill="#1e293b"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="1"
                  />
                  <text
                    x="10"
                    y="13.5"
                    fill="#94a3b8"
                    fontSize="9"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    AM
                  </text>
                  <text x="28" y="11" fill="#f1f5f9" fontSize="11" fontWeight="600">
                    Alex M. (Platform Lead)
                  </text>
                  <text x="28" y="22" fill="#64748b" fontSize="9.5">
                    Accepted AI circuit breaker fix
                  </text>
                </g>
              </g>
            </g>
          </svg>
        </div>

        {/* Center Hero Content */}
        <div className="hero-center-content">
          <h1 className="hero-headline">
            Where Teams Review Architecture.
            <br />
            <span className="hero-headline-gradient">
              Live Voice. Real Chaos. An AI SRE in the Call.
            </span>
          </h1>

          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-primary btn-hero"
              onClick={() => onLaunchStudio()}
            >
              Start Live Review Room &rarr;
            </button>

            <a href="#meeting-room" className="btn btn-secondary btn-hero">
              See How Meetings Work
            </a>
          </div>
        </div>
      </section>

      {/* SECTION 1: The Live Architecture Review Meeting Room */}
      <section id="meeting-room" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">THE REAL-TIME REVIEW ROOM</span>
          <h2 className="section-title">Google Meet Built Inside an Architecture Canvas</h2>
          <p className="section-desc">
            Stop screen-sharing static diagrams while arguing theoretically. Resilio brings your
            entire engineering team into one shared room with voice, live cursors, and interactive
            failure injection.
          </p>
        </div>

        <div className="steps-pipeline-grid">
          <div className="step-card">
            <div className="step-badge">INTEGRATED AUDIO</div>
            <div className="step-icon-wrap cyan">
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </div>
            <h3 className="step-title">Push-to-Talk Team Voice</h3>
            <p className="step-desc">
              Jump into the room with zero Zoom or Meet links. Talk naturally with low-latency audio
              while pointing at nodes and discussing connection limits together.
            </p>
            <div className="step-tags">
              <span>Instant Room Voice</span>
              <span>Multiplayer Cursors</span>
              <span>Zero Installs</span>
            </div>
          </div>

          <div className="step-card">
            <div className="step-badge">SHARED CHAOS DIAL</div>
            <div className="step-icon-wrap amber">
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h3 className="step-title">Simulate Failures Live in the Call</h3>
            <p className="step-desc">
              When an engineer asks "What happens if Redis latency spikes?", turn the slider live in
              the meeting. Everyone sees the p99 latency curve jump and requests queue up
              synchronously.
            </p>
            <div className="step-tags">
              <span>Live Packet Lag</span>
              <span>Service Crashes</span>
              <span>Synchronous Metrics</span>
            </div>
          </div>

          <div className="step-card">
            <div className="step-badge">COLLABORATIVE DAG</div>
            <div className="step-icon-wrap blue">
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <h3 className="step-title">Collaborative Spatial Editing</h3>
            <p className="step-desc">
              Anyone in the review can drop a cache, re-route a payment gateway, or adjust thread
              pool bounds. No single-person bottleneck sharing a screen.
            </p>
            <div className="step-tags">
              <span>Multi-User Canvas</span>
              <span>Magnetic Orthogonal Wires</span>
              <span>DAG Linter</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: The Meta AI SRE in the Meeting */}
      <section id="ai-copilot" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">AUTONOMOUS MEETING PARTICIPANT</span>
          <h2 className="section-title">An AI Principal SRE in Every Review Meeting</h2>
          <p className="section-desc">
            Not a chatbot you copy-paste into. An active participant listening to the call, running
            invariant checks in the background, and speaking up before bad designs reach code.
          </p>
        </div>

        <div className="comparison-container">
          <div className="comparison-card legacy">
            <div className="comparison-card-header">
              <span className="comparison-tag red">CONVENTIONAL RFC MEETINGS</span>
              <h3 className="comparison-heading">Human Arguments on Static Docs</h3>
              <p className="comparison-sub">Google Docs, Zoom, Miro screen share</p>
            </div>
            <ul className="comparison-list">
              <li>
                <span className="comparison-icon red">&times;</span>
                <div>
                  <strong>Blind Assumptions:</strong> Engineers guess failure domains; nobody
                  notices that a 3x retry loop will take down the billing cluster.
                </div>
              </li>
              <li>
                <span className="comparison-icon red">&times;</span>
                <div>
                  <strong>Endless Theoretical Debates:</strong> Meetings drag on for hours debating
                  timeout values without any empirical data.
                </div>
              </li>
              <li>
                <span className="comparison-icon red">&times;</span>
                <div>
                  <strong>Manual Translation to Code:</strong> After agreement, someone spends days
                  manually writing boilerplate Terraform from whiteboard screenshots.
                </div>
              </li>
            </ul>
          </div>

          <div className="comparison-card active-resilio">
            <div className="comparison-card-badge">THE RESILIO ADVANTAGE</div>
            <div className="comparison-card-header">
              <span className="comparison-tag blue">LIVE RESILIO REVIEW ROOM</span>
              <h3 className="comparison-heading">Team + Autonomous AI SRE Copilot</h3>
              <p className="comparison-sub">Real-Time Reliability Intelligence in the Call</p>
            </div>
            <ul className="comparison-list">
              <li>
                <span className="comparison-icon green">&#10003;</span>
                <div>
                  <strong>Listens &amp; Flags Hazards:</strong> When someone suggests aggressive
                  retries, the AI SRE warns the room of cascading thread starvation immediately.
                </div>
              </li>
              <li>
                <span className="comparison-icon green">&#10003;</span>
                <div>
                  <strong>Suggests Live Proven Patches:</strong> Proposes exact circuit-breaker trip
                  thresholds and jittered backoffs with verified mathematical guarantees.
                </div>
              </li>
              <li>
                <span className="comparison-icon green">&#10003;</span>
                <div>
                  <strong>Direct IaC Export:</strong> When the call ends, export the approved design
                  straight to production Terraform and Envoy configs in seconds.
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Enterprise Metrics Bar */}
        <div className="metrics-banner">
          <div className="metric-cell">
            <span className="metric-number">20 min</span>
            <span className="metric-label">Avg Architecture Review Time</span>
          </div>
          <div className="metric-cell">
            <span className="metric-number">80%</span>
            <span className="metric-label">Outage Blind Spots Caught Live</span>
          </div>
          <div className="metric-cell">
            <span className="metric-number">100%</span>
            <span className="metric-label">Team Alignment Before Merge</span>
          </div>
          <div className="metric-cell">
            <span className="metric-number">0</span>
            <span className="metric-label">Manual Terraform Boilerplate</span>
          </div>
        </div>
      </section>

      {/* SECTION 3: How an Architecture Review Works */}
      <section id="how-it-works" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">THE 3-STEP REVIEW WORKFLOW</span>
          <h2 className="section-title">From Debate to Verified Infrastructure in 20 Minutes</h2>
          <p className="section-desc">
            Replace weeks of slow email threads and speculative RFC comments with one live meeting.
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
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3 className="step-title">Join the Room on Live Audio</h3>
            <p className="step-desc">
              Your team jumps into the room on push-to-talk voice. Drop in a proposed topology DAG
              or import an existing Docker Compose setup.
            </p>
            <div className="step-tags">
              <span>Push-to-Talk Voice</span>
              <span>Docker Ingest</span>
              <span>Live Cursors</span>
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
            <h3 className="step-title">Stress-Test Failure Modes Together</h3>
            <p className="step-desc">
              Simulate cross-region network lag, kill database replicas, or throttle payment APIs.
              The entire team watches how the topology responds.
            </p>
            <div className="step-tags">
              <span>Real Packet Chaos</span>
              <span>p99 Latency Curves</span>
              <span>Zero Production Risk</span>
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h3 className="step-title">Accept AI Fixes &amp; Export IaC</h3>
            <p className="step-desc">
              The AI SRE detects retry storms and proposes circuit breakers. Review and accept the
              patch together, then export directly to Terraform and Envoy configs before leaving the
              call.
            </p>
            <div className="step-tags">
              <span>Meta AI SRE Patches</span>
              <span>Terraform (.tf)</span>
              <span>Envoy YAML</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Why Top Teams Switch */}
      <section id="why-switch" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">WHY RESILIO</span>
          <h2 className="section-title">Built for Engineering Teams That Value Reliability</h2>
          <p className="section-desc">
            Give your staff engineers and architects complete confidence before deploying new
            distributed services.
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
              <h3 className="bento-title">Consensus Through Evidence, Not Status</h3>
            </div>
            <p className="bento-desc">
              Instead of the most senior engineer in the room winning an argument by default,
              Resilio lets teams simulate the failure mode live. Facts settle architectural debates
              in 5 minutes.
            </p>
            <div className="bento-callout">
              <span className="callout-label">EVIDENCE-BASED:</span>
              <span>Test the proposal against real chaos live in the meeting room.</span>
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
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <h3 className="bento-title">Eliminate 3 AM Outages</h3>
            </div>
            <p className="bento-desc">
              Most P0 outages are caused by cascading retries and missing timeouts. Catch them in
              the design review meeting before writing production code.
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
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <h3 className="bento-title">A Principal SRE in Every Squad</h3>
            </div>
            <p className="bento-desc">
              Give every development squad access to principal reliability engineering expertise
              with Meta AI actively participating in design reviews.
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
                </svg>
              </div>
              <h3 className="bento-title">From Meeting to Terraform in One Click</h3>
            </div>
            <p className="bento-desc">
              Never let architecture diagrams gather dust in a wiki. Export the verified design
              straight into production-ready HashiCorp Terraform modules and Envoy Proxy filters
              before ending the call.
            </p>
            <div className="bento-callout">
              <span className="callout-label">PRODUCTION-READY:</span>
              <span>
                HashiCorp Terraform (.tf) &bull; Envoy Proxy YAML &bull; Kubernetes Manifests
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: Transparent Pricing */}
      <section id="pricing" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">PRICING</span>
          <h2 className="section-title">Simple, Team-First Pricing</h2>
          <p className="section-desc">
            Start free with your own sandbox. Upgrade when your team wants collaborative review
            rooms with the AI SRE copilot.
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
              <span className="pricing-tier-badge">INDIVIDUAL</span>
              <h3 className="pricing-tier-title">Developer</h3>
              <p className="pricing-tier-desc">
                For individual engineers exploring failure simulation and topology design.
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
              Start Free Sandbox &rarr;
            </button>

            <div className="pricing-features-list">
              <span className="pricing-feature-header">INCLUDED:</span>
              <ul>
                <li>
                  <span>&#10003;</span> Up to 15 services per canvas
                </li>
                <li>
                  <span>&#10003;</span> Real-time network latency &amp; chaos injection
                </li>
                <li>
                  <span>&#10003;</span> Standard topology design templates
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
            <div className="popular-glow-badge">RECOMMENDED FOR TEAMS</div>
            <div className="pricing-tier-header">
              <span className="pricing-tier-badge pro">TEAM PRO</span>
              <h3 className="pricing-tier-title">Team Pro</h3>
              <p className="pricing-tier-desc">
                For engineering squads running collaborative reviews with the AI SRE agent.
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
                  <span>&#10003;</span> Live review rooms with push-to-talk team voice
                </li>
                <li>
                  <span>&#10003;</span> Meta AI SRE active meeting participant &amp; fix suggestions
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
              <span className="pricing-tier-badge">ORGANIZATION</span>
              <h3 className="pricing-tier-title">Enterprise</h3>
              <p className="pricing-tier-desc">
                For high-growth scaleups requiring dedicated VPCs, SSO, and compliance.
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
              <span className="pricing-feature-header">ENTERPRISE SECURITY &amp; CONTROL:</span>
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

      {/* SECTION 6: Frequently Asked Questions */}
      <section id="faq" className="landing-section">
        <div className="section-header">
          <span className="section-eyebrow">QUESTIONS &amp; ANSWERS</span>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-desc">
            Quick, straightforward answers about Resilio's live review rooms and AI SRE copilot.
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
                    <h3 className="faq-title">{faq.question}</h3>
                  </div>
                  <span className="faq-toggle-icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </span>
                </div>
                <div className="faq-answer-collapse">
                  <div className="faq-answer-content">
                    <p>{faq.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 7: Bottom CTA Conversion Banner */}
      <section className="landing-cta-banner-wrap">
        <div className="landing-cta-banner">
          <div className="cta-ambient-glow" aria-hidden="true" />
          <h2 className="cta-banner-title">Stop Debating Architecture in the Dark.</h2>
          <p className="cta-banner-desc">
            Run your next architecture review in Resilio. Join on voice, test live chaos, and let an
            AI SRE catch failure loops before you deploy.
          </p>
          <div className="cta-banner-actions">
            <button
              type="button"
              className="btn btn-primary btn-hero"
              onClick={() => onLaunchStudio()}
            >
              Start Free Review Room &rarr;
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

      {/* SECTION 8: Clean Enterprise Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="footer-columns-grid">
            {/* Col 1: Brand & Description */}
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
                The Real-Time Collaborative Architecture Review Room with Autonomous AI SRE Copilot.
              </p>
            </div>

            {/* Col 2: Product */}
            <div className="footer-col">
              <h4 className="footer-col-title">Product</h4>
              <ul className="footer-col-links">
                <li>
                  <a href="#meeting-room">Review Rooms</a>
                </li>
                <li>
                  <a href="#ai-copilot">AI SRE in Meeting</a>
                </li>
                <li>
                  <a href="#how-it-works">Failure Simulation</a>
                </li>
                <li>
                  <a href="#why-switch">Terraform &amp; Envoy Export</a>
                </li>
              </ul>
            </div>

            {/* Col 3: Solutions */}
            <div className="footer-col">
              <h4 className="footer-col-title">Solutions</h4>
              <ul className="footer-col-links">
                <li>
                  <a href="#why-switch">Pre-Production Outage Prevention</a>
                </li>
                <li>
                  <a href="#meeting-room">Live Architecture Reviews</a>
                </li>
                <li>
                  <a href="#ai-copilot">Cascading Retry Elimination</a>
                </li>
                <li>
                  <a href="#how-it-works">Evidence-Based Design RFCs</a>
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
                  <a href="#how-it-works">Review Workflow</a>
                </li>
                <li>
                  <a href="#meeting-room">Live Room Features</a>
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
              <span>Encrypted TLS 1.3</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
