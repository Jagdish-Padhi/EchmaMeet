import { MetricsBanner } from './MetricsBanner';

export function AiSreSection() {
  return (
    <section id="ai-copilot" className="landing-section alt-bg">
      <div className="section-header">
        <span className="section-eyebrow">YOUR AUTONOMOUS MEETING PARTICIPANT</span>
        <h2 className="section-title">An AI SRE Sitting at the Table with Your Team</h2>
        <p className="section-desc">
          EchmaMeet&apos;s Meta AI agent doesn&apos;t just generate text. It sits in your review
          call like a principal reliability engineer—listening, stress-testing hypotheses, and
          raising its hand when it spots hidden cascading failure risks.
        </p>
      </div>

      <div className="features-split-grid">
        <div className="feature-interactive-card">
          <div className="card-ambient-aura" aria-hidden="true" />
          <div className="agentic-bubble-header">
            <div className="agentic-avatar">
              <span className="ai-agent-pulse-ring" />
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#38bdf8" strokeWidth="2" />
                <circle cx="12" cy="12" r="3" fill="#38bdf8" />
              </svg>
            </div>
            <div className="agentic-title-group">
              <span className="agentic-name">Meta AI Autonomous SRE</span>
              <span className="agentic-badge">IN MEETING NOW</span>
            </div>
          </div>

          <div className="meeting-chat-preview">
            <div className="meeting-dialogue-item reviewer">
              <div className="reviewer-avatar">AC</div>
              <div className="reviewer-bubble">
                <span className="reviewer-name">Alex Chen (Staff SRE)</span>
                <p>
                  &quot;If Checkout Service times out calling Payments, let&apos;s just add an
                  immediate 3x retry so the user doesn&apos;t see an error.&quot;
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
                <div className="ai-bubble-tag">META AI SRE &bull; RAISED HAND</div>
                <p className="ai-bubble-warning">
                  &quot;Careful team: immediate 3x retries on a degraded downstream service creates
                  a <strong>Retry Storm</strong>. In our simulated 500 RPS load, downstream queue
                  depth quadruples and drops 78% of good traffic.&quot;
                </p>
                <div className="ai-bubble-solution">
                  <span className="solution-tag">RECOMMENDED FIX</span>
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
                <strong>Listens to Voice Context:</strong> Understands what the team is trying to
                build and contextualizes warnings to your specific architecture patterns.
              </div>
            </li>
            <li>
              <span className="comparison-icon green">&#10003;</span>
              <div>
                <strong>Detects Cascading Traps Live:</strong> Catches missing jitter, queue
                saturation, single points of failure, and cold cache stampedes before they reach
                code.
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

      <MetricsBanner />
    </section>
  );
}
