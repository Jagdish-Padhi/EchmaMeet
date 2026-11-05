export function HowItWorksSection() {
  return (
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
          <div className="step-icon-wrap">
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
            Your team jumps into the room on push-to-talk voice. Drop in a proposed topology DAG or
            import an existing Docker Compose setup.
          </p>
          <div className="step-tags">
            <span>Push-to-Talk Voice</span>
            <span>Docker Ingest</span>
            <span>Live Cursors</span>
          </div>
        </div>

        <div className="step-card">
          <div className="step-badge">STEP 2</div>
          <div className="step-icon-wrap">
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
            Simulate cross-region network lag, kill database replicas, or throttle payment APIs. The
            entire team watches how the topology responds.
          </p>
          <div className="step-tags">
            <span>Real Packet Chaos</span>
            <span>p99 Latency Curves</span>
            <span>Zero Production Risk</span>
          </div>
        </div>

        <div className="step-card">
          <div className="step-badge">STEP 3</div>
          <div className="step-icon-wrap">
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
            <span>Autonomous SRE Patches</span>
            <span>Terraform (.tf)</span>
            <span>Envoy YAML</span>
          </div>
        </div>
      </div>
    </section>
  );
}
