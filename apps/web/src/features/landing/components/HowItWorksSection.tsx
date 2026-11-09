export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="landing-section">
      <div className="section-header">
        <span className="section-eyebrow">HOW IT WORKS</span>
        <h2 className="section-title">From Design Debate to Verified Infrastructure in 20 Minutes</h2>
        <p className="section-desc">
          Replace slow, multi-week RFC comment threads with one live review session.
        </p>
      </div>

      <div className="steps-pipeline-grid">
        <div className="step-card">
          <div className="step-badge">STAGE 1</div>
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
          <h3 className="step-title">Assemble on Push-to-Talk Audio</h3>
          <p className="step-desc">
            Join the room with one click. Import an existing Docker Compose architecture or draw
            services directly on the shared canvas.
          </p>
          <div className="step-tags">
            <span>Low-Latency Voice</span>
            <span>Docker Compose Import</span>
            <span>Shared Cursors</span>
          </div>
        </div>

        <div className="step-card">
          <div className="step-badge">STAGE 2</div>
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
          <h3 className="step-title">Simulate Extreme Failure Modes</h3>
          <p className="step-desc">
            Inject packet latency, sever connections, and saturate queues. The entire team monitors
            real-time p99 latency degradation.
          </p>
          <div className="step-tags">
            <span>Deterministic Chaos</span>
            <span>p99 Latency Curves</span>
            <span>Safe Simulation</span>
          </div>
        </div>

        <div className="step-card">
          <div className="step-badge">STAGE 3</div>
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
          <h3 className="step-title">Validate AI Fixes &amp; Export IaC</h3>
          <p className="step-desc">
            The AI SRE identifies cascading risks and suggests optimal circuit breakers and
            backoffs. Verify the fix and export directly to Terraform and Envoy.
          </p>
          <div className="step-tags">
            <span>AI Resiliency Patches</span>
            <span>HashiCorp Terraform</span>
            <span>Envoy YAML</span>
          </div>
        </div>
      </div>
    </section>
  );
}
