import { memo } from 'react';

export const HeroBackdrop = memo(function HeroBackdrop() {
  return (
    <div className="hero-backdrop-layer" aria-hidden="true">
      <svg
        className="hero-backdrop-svg"
        viewBox="0 0 1440 760"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="hero-matrix-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="rgba(255, 255, 255, 0.04)" />
          </pattern>

          <marker
            id="hero-arrow"
            viewBox="0 0 10 10"
            refX="7.5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path className="hero-backdrop-marker" d="M 0 1.5 L 7.5 5 L 0 8.5 Z" fill="#475569" />
          </marker>

          <filter id="neon-flow-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation="1.2"
              floodColor="#38bdf8"
              floodOpacity="0.8"
            />
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#hero-matrix-grid)" />

        {/* Left Vertical Flow: Gateway -> Auth -> Kafka */}
        <path
          className="hero-backdrop-flow-line"
          d="M 140 210 L 140 310"
          fill="none"
          stroke="#334155"
          strokeWidth="1.8"
          markerEnd="url(#hero-arrow)"
        />
        <g>
          <animateMotion path="M 140 210 L 140 310" dur="3.8s" repeatCount="indefinite" />
          <circle r="2.2" fill="#38bdf8" filter="url(#neon-flow-glow)" />
          <circle r="1" fill="#ffffff" />
        </g>

        <path
          className="hero-backdrop-flow-line"
          d="M 140 380 L 140 480"
          fill="none"
          stroke="#334155"
          strokeWidth="1.8"
          markerEnd="url(#hero-arrow)"
        />
        <g>
          <animateMotion path="M 140 380 L 140 480" dur="4.2s" repeatCount="indefinite" />
          <circle r="2.2" fill="#38bdf8" filter="url(#neon-flow-glow)" />
          <circle r="1" fill="#ffffff" />
        </g>

        {/* Bottom Interconnect: Kafka -> Order Worker -> Redis -> SLO Guard -> Patch Engine */}
        <path
          className="hero-backdrop-flow-line"
          d="M 240 515 L 290 515 Q 310 515, 310 560 L 310 635 L 330 635"
          fill="none"
          stroke="#334155"
          strokeWidth="1.8"
          markerEnd="url(#hero-arrow)"
        />
        <g>
          <animateMotion
            path="M 240 515 L 290 515 Q 310 515, 310 560 L 310 635 L 330 635"
            dur="5.5s"
            repeatCount="indefinite"
          />
          <circle r="2.2" fill="#38bdf8" filter="url(#neon-flow-glow)" />
          <circle r="1" fill="#ffffff" />
        </g>

        <path
          className="hero-backdrop-flow-line"
          d="M 530 635 L 610 635"
          fill="none"
          stroke="#334155"
          strokeWidth="1.8"
          markerEnd="url(#hero-arrow)"
        />
        <g>
          <animateMotion path="M 530 635 L 610 635" dur="4.0s" repeatCount="indefinite" />
          <circle r="2.2" fill="#38bdf8" filter="url(#neon-flow-glow)" />
          <circle r="1" fill="#ffffff" />
        </g>

        <path
          className="hero-backdrop-flow-line"
          d="M 810 635 L 890 635"
          fill="none"
          stroke="#334155"
          strokeWidth="1.8"
          markerEnd="url(#hero-arrow)"
        />
        <g>
          <animateMotion path="M 810 635 L 890 635" dur="4.2s" repeatCount="indefinite" />
          <circle r="2.2" fill="#38bdf8" filter="url(#neon-flow-glow)" />
          <circle r="1" fill="#ffffff" />
        </g>

        <path
          className="hero-backdrop-flow-line"
          d="M 1090 635 L 1150 635 Q 1170 635, 1170 590 L 1170 520 L 1180 520"
          fill="none"
          stroke="#334155"
          strokeWidth="1.8"
          markerEnd="url(#hero-arrow)"
        />
        <g>
          <animateMotion
            path="M 1090 635 L 1150 635 Q 1170 635, 1170 590 L 1170 520 L 1180 520"
            dur="5.2s"
            repeatCount="indefinite"
          />
          <circle r="2.2" fill="#38bdf8" filter="url(#neon-flow-glow)" />
          <circle r="1" fill="#ffffff" />
        </g>

        {/* Right Vertical Flow: SRE Node -> Meeting Room -> Patch Engine */}
        <path
          className="hero-backdrop-flow-line"
          d="M 1290 215 L 1290 270"
          fill="none"
          stroke="#334155"
          strokeWidth="1.8"
          markerEnd="url(#hero-arrow)"
        />
        <g>
          <animateMotion path="M 1290 215 L 1290 270" dur="3.6s" repeatCount="indefinite" />
          <circle r="2.2" fill="#38bdf8" filter="url(#neon-flow-glow)" />
          <circle r="1" fill="#ffffff" />
        </g>

        <path
          className="hero-backdrop-flow-line"
          d="M 1290 420 L 1290 480"
          fill="none"
          stroke="#334155"
          strokeWidth="1.8"
          markerEnd="url(#hero-arrow)"
        />
        <g>
          <animateMotion path="M 1290 420 L 1290 480" dur="3.8s" repeatCount="indefinite" />
          <circle r="2.2" fill="#38bdf8" filter="url(#neon-flow-glow)" />
          <circle r="1" fill="#ffffff" />
        </g>

        {/* Block 1: Ingress API Gateway (Top-Left) */}
        <g transform="translate(40, 140)">
          <rect
            className="hero-backdrop-node"
            width="200"
            height="70"
            rx="8"
            fill="rgba(14, 18, 28, 0.75)"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1.2"
          />
          <rect x="12" y="12" width="24" height="24" rx="5" fill="rgba(8, 102, 255, 0.15)" />
          <text className="hero-backdrop-text-primary" x="44" y="24" fill="#f8fafc" fontSize="12" fontWeight="600">
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
            INGRESS ENTRY
          </text>
          <text className="hero-backdrop-text-secondary" x="14" y="58" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
            50w &bull; 5ms &bull; bounded 100
          </text>
        </g>

        {/* Block 2: Auth Service (Mid-Left) */}
        <g transform="translate(40, 310)">
          <rect
            className="hero-backdrop-node"
            width="200"
            height="70"
            rx="8"
            fill="rgba(14, 18, 28, 0.75)"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1.2"
          />
          <rect x="12" y="12" width="24" height="24" rx="5" fill="rgba(56, 189, 248, 0.12)" />
          <text className="hero-backdrop-text-primary" x="44" y="24" fill="#f8fafc" fontSize="12" fontWeight="600">
            Auth Service
          </text>
          <text
            x="44"
            y="35"
            fill="#818cf8"
            fontSize="8.5"
            fontFamily="var(--font-mono)"
            fontWeight="700"
          >
            INTERNAL SERVICE
          </text>
          <text className="hero-backdrop-text-secondary" x="14" y="58" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
            30w &bull; 12ms &bull; rate: 500 RPS
          </text>
        </g>

        {/* Block 3: Kafka Event Bus (Bottom-Left) */}
        <g transform="translate(40, 480)">
          <rect
            className="hero-backdrop-node"
            width="200"
            height="70"
            rx="8"
            fill="rgba(14, 18, 28, 0.75)"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1.2"
          />
          <rect x="12" y="12" width="24" height="24" rx="5" fill="rgba(34, 211, 238, 0.12)" />
          <text className="hero-backdrop-text-primary" x="44" y="24" fill="#f8fafc" fontSize="12" fontWeight="600">
            Kafka Event Bus
          </text>
          <text
            x="44"
            y="35"
            fill="#22d3ee"
            fontSize="8.5"
            fontFamily="var(--font-mono)"
            fontWeight="700"
          >
            QUEUE CONSUMER
          </text>
          <text className="hero-backdrop-text-secondary" x="14" y="58" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
            consume: 120 RPS &bull; lag: 0
          </text>
        </g>

        {/* Block 4: Order Worker */}
        <g transform="translate(330, 600)">
          <rect
            className="hero-backdrop-node"
            width="200"
            height="70"
            rx="8"
            fill="rgba(14, 18, 28, 0.75)"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1.2"
          />
          <rect x="12" y="12" width="24" height="24" rx="5" fill="rgba(8, 102, 255, 0.15)" />
          <text className="hero-backdrop-text-primary" x="44" y="24" fill="#f8fafc" fontSize="12" fontWeight="600">
            Order Worker
          </text>
          <text
            x="44"
            y="35"
            fill="#38bdf8"
            fontSize="8.5"
            fontFamily="var(--font-mono)"
            fontWeight="700"
          >
            ASYNC WORKER
          </text>
          <text className="hero-backdrop-text-secondary" x="14" y="58" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
            40w &bull; 8ms &bull; pool: 25
          </text>
        </g>

        {/* Block 5: Redis Cache */}
        <g transform="translate(610, 600)">
          <rect
            className="hero-backdrop-node"
            width="200"
            height="70"
            rx="8"
            fill="rgba(14, 18, 28, 0.75)"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1.2"
          />
          <rect x="12" y="12" width="24" height="24" rx="5" fill="rgba(250, 204, 21, 0.12)" />
          <text className="hero-backdrop-text-primary" x="44" y="24" fill="#f8fafc" fontSize="12" fontWeight="600">
            Redis Cache
          </text>
          <text
            x="44"
            y="35"
            fill="#facc15"
            fontSize="8.5"
            fontFamily="var(--font-mono)"
            fontWeight="700"
          >
            IN-MEMORY CACHE
          </text>
          <text className="hero-backdrop-text-secondary" x="14" y="58" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
            ttl: 60s &bull; hit-rate: 94.2%
          </text>
        </g>

        {/* Block 6: SLO Guard */}
        <g transform="translate(890, 600)">
          <rect
            className="hero-backdrop-node"
            width="200"
            height="70"
            rx="8"
            fill="rgba(14, 18, 28, 0.75)"
            stroke="rgba(16, 185, 129, 0.25)"
            strokeWidth="1.2"
          />
          <rect x="12" y="12" width="24" height="24" rx="5" fill="rgba(16, 185, 129, 0.15)" />
          <text className="hero-backdrop-text-primary" x="44" y="24" fill="#f8fafc" fontSize="12" fontWeight="600">
            SLO Guard
          </text>
          <text
            x="44"
            y="35"
            fill="#10b981"
            fontSize="8.5"
            fontFamily="var(--font-mono)"
            fontWeight="700"
          >
            ALL INVARIANTS PASS
          </text>
          <text className="hero-backdrop-text-secondary" x="14" y="58" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
            error budget: 99.98% intact
          </text>
        </g>

        {/* Block 7: Autonomous SRE Node (Top-Right) */}
        <g transform="translate(1180, 130)">
          <rect
            className="hero-backdrop-node"
            width="220"
            height="85"
            rx="10"
            fill="rgba(14, 18, 28, 0.75)"
            stroke="rgba(56, 189, 248, 0.25)"
            strokeWidth="1.2"
          />
          <text className="hero-backdrop-text-primary" x="18" y="28" fill="#f8fafc" fontSize="12.5" fontWeight="700">
            Autonomous SRE in Call
          </text>
          <text
            x="18"
            y="43"
            fill="#38bdf8"
            fontSize="9"
            fontFamily="var(--font-mono)"
            fontWeight="700"
          >
            ACTIVE PARTICIPANT
          </text>
          <text className="hero-backdrop-text-secondary" x="18" y="66" fill="#94a3b8" fontSize="10.5">
            &ldquo;Flagged 3x retry; patch ready.&rdquo;
          </text>
        </g>

        {/* Block 8: Collaborative Meeting Room (Mid-Right) */}
        <g transform="translate(1180, 270)">
          <rect
            className="hero-backdrop-node"
            width="220"
            height="150"
            rx="10"
            fill="rgba(14, 18, 28, 0.75)"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1.2"
          />
          <rect x="14" y="14" width="8" height="8" rx="4" fill="#38bdf8" />
          <text className="hero-backdrop-text-primary" x="28" y="21" fill="#e2e8f0" fontSize="11" fontWeight="600">
            #arch-review
          </text>
          <text
            x="206"
            y="21"
            fill="#64748b"
            fontSize="8.5"
            fontFamily="var(--font-mono)"
            textAnchor="end"
          >
            VOICE ON
          </text>
          <line
            x1="14"
            y1="34"
            x2="206"
            y2="34"
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth="1"
          />
          <g transform="translate(14, 46)">
            <circle cx="10" cy="10" r="10" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.2" />
            <text x="10" y="13.5" fill="#38bdf8" fontSize="9" fontWeight="700" textAnchor="middle">
              SC
            </text>
            <text className="hero-backdrop-text-primary" x="28" y="11" fill="#f1f5f9" fontSize="11" fontWeight="600">
              Sarah C. (Staff SRE)
            </text>
            <text className="hero-backdrop-text-secondary" x="28" y="22" fill="#64748b" fontSize="9">
              Speaking &bull; Simulated DB lag
            </text>
          </g>
          <g transform="translate(14, 86)">
            <circle
              cx="10"
              cy="10"
              r="10"
              fill="#1e293b"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1"
            />
            <text x="10" y="13.5" fill="#94a3b8" fontSize="9" fontWeight="700" textAnchor="middle">
              AM
            </text>
            <text className="hero-backdrop-text-primary" x="28" y="11" fill="#f1f5f9" fontSize="11" fontWeight="600">
              Alex M. (Platform Lead)
            </text>
            <text className="hero-backdrop-text-secondary" x="28" y="22" fill="#64748b" fontSize="9">
              Accepted AI circuit breaker
            </text>
          </g>
        </g>

        {/* Block 9: Autonomous Patch Engine (Bottom-Right) */}
        <g transform="translate(1180, 480)">
          <rect
            className="hero-backdrop-node"
            width="220"
            height="70"
            rx="8"
            fill="rgba(14, 18, 28, 0.75)"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1.2"
          />
          <rect x="12" y="12" width="24" height="24" rx="5" fill="rgba(56, 189, 248, 0.1)" />
          <text className="hero-backdrop-text-primary" x="44" y="24" fill="#f8fafc" fontSize="12" fontWeight="600">
            AI Patch Engine
          </text>
          <text
            x="44"
            y="35"
            fill="#38bdf8"
            fontSize="8.5"
            fontFamily="var(--font-mono)"
            fontWeight="700"
          >
            PARETO OPTIMAL
          </text>
          <text className="hero-backdrop-text-secondary" x="14" y="58" fill="#64748b" fontSize="9.5" fontFamily="var(--font-mono)">
            automated rollback armed
          </text>
        </g>
      </svg>
    </div>
  );
});
