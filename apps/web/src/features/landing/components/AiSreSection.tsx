import { MetricsBanner } from './MetricsBanner';

export function AiSreSection() {
  return (
    <section id="ai-copilot" className="landing-section alt-bg">
      <div className="section-header">
        <span className="section-eyebrow">AUTONOMOUS RELIABILITY COPILOT</span>
        <h2 className="section-title">An AI Reliability Engineer in Every Review Session</h2>
        <p className="section-desc">
          Echma participates directly in your review call, understanding speech in Hindi, English,
          and Hinglish via Gnani Prisma. It intervenes in real time when it detects cascading
          failure traps.
        </p>
      </div>

      <div className="features-split-grid">
        <div className="feature-interactive-card">
          <div className="agentic-bubble-header">
            <div className="agentic-avatar">
              <span className="ai-agent-pulse-ring" />
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#38bdf8" strokeWidth="2" />
                <circle cx="12" cy="12" r="3" fill="#38bdf8" />
              </svg>
            </div>
            <div className="agentic-title-group">
              <span className="agentic-name">Echma Autonomous SRE</span>
              <span className="agentic-badge">ACTIVE IN MEETING</span>
            </div>
          </div>

          <div className="meeting-chat-preview">
            <div className="meeting-dialogue-item reviewer">
              <div className="reviewer-avatar">PE</div>
              <div className="reviewer-bubble">
                <span className="reviewer-name">Staff SRE</span>
                <p>
                  &quot;If Checkout Service times out calling Payments, let&apos;s add an immediate
                  3x retry so users don&apos;t see an error.&quot;
                </p>
              </div>
            </div>

            <div className="meeting-dialogue-item ai-intervention">
              <div className="ai-avatar-tag">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                  <path
                    d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                    stroke="#f59e0b"
                    strokeWidth="2"
                  />
                  <line x1="12" y1="9" x2="12" y2="13" stroke="#f59e0b" strokeWidth="2" />
                  <circle cx="12" cy="17" r="1" fill="#f59e0b" />
                </svg>
              </div>
              <div className="ai-bubble">
                <div className="ai-bubble-tag">ECHMA SRE &bull; RAISED HAND</div>
                <p className="ai-bubble-warning">
                  &quot;Immediate 3x retries against a degraded downstream service trigger a{' '}
                  <strong>Retry Storm</strong>. In our simulated 500 RPS load, downstream queue
                  depth quadruples and drops 78% of valid traffic.&quot;
                </p>
                <div className="ai-bubble-solution">
                  <span className="solution-tag">RECOMMENDED MITIGATION</span>
                  <p>
                    Switch to <strong>Exponential Backoff + Full Jitter</strong> with a{' '}
                    <strong>Circuit Breaker (5 consecutive errors, 10s cooldown)</strong>. Error
                    budget remains 99.98% protected.
                  </p>
                  <div className="ai-patch-pills">
                    <span>Backoff: 200ms base</span>
                    <span>Jitter: Full</span>
                    <span>Breaker: 50% trip</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="features-checklist-card">
          <h3 className="checklist-title">How the In-Meeting Copilot Protects You</h3>
          <ul className="checklist-items">
            <li>
              <span className="comparison-icon green">&#10003;</span>
              <div>
                <strong>Understands Architectural Context:</strong> Listens to voice discussion and
                maps risks to your exact service topology and dependencies.
              </div>
            </li>
            <li>
              <span className="comparison-icon green">&#10003;</span>
              <div>
                <strong>Detects Cascading Traps Live:</strong> Catches missing jitter, queue
                saturation, and single points of failure before code is written.
              </div>
            </li>
            <li>
              <span className="comparison-icon green">&#10003;</span>
              <div>
                <strong>Suggests Empirically Proven Patches:</strong> Calculates exact circuit
                breaker trip thresholds and retry budgets with mathematical precision.
              </div>
            </li>
            <li>
              <span className="comparison-icon green">&#10003;</span>
              <div>
                <strong>Direct IaC Export:</strong> Generates production-ready Terraform modules and
                Envoy configurations the moment you approve the fix.
              </div>
            </li>
          </ul>
        </div>
      </div>

      <MetricsBanner />
    </section>
  );
}
