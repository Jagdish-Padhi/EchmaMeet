export function ComparisonSection() {
  return (
    <section id="why-switch" className="landing-section">
      <div className="section-header">
        <span className="section-eyebrow">EVIDENCE OVER ASSUMPTIONS</span>
        <h2 className="section-title">Built for Teams That Value Reliability</h2>
        <p className="section-desc">
          Give your staff engineers and architects empirical confidence before deploying
          distributed services.
        </p>
      </div>

      <div className="bento-grid">
        <div className="bento-card bento-span-2">
          <div className="bento-header">
            <div className="bento-icon">
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
            <h3 className="bento-title">Consensus Through Evidence, Not Hierarchy</h3>
          </div>
          <p className="bento-desc">
            Instead of seniority dictating architecture decisions, simulate the failure mode live.
            Empirical simulation settles debates with hard data in minutes.
          </p>
          <div className="bento-callout">
            <span className="callout-label">EVIDENCE-BASED:</span>
            <span>Test proposals against deterministic chaos live in the meeting.</span>
          </div>
        </div>

        <div className="bento-card">
          <div className="bento-header">
            <div className="bento-icon">
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
            <h3 className="bento-title">Eliminate Cascading Outages Pre-Deploy</h3>
          </div>
          <p className="bento-desc">
            Most severe production incidents are caused by retry amplification and missing timeouts.
            Eliminate them in design review before shipping code.
          </p>
        </div>

        <div className="bento-card">
          <div className="bento-header">
            <div className="bento-icon">
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
            Equip every product engineering team with principal reliability expertise through an
            autonomous AI SRE analyzing edge cases in real time.
          </p>
        </div>

        <div className="bento-card bento-span-2">
          <div className="bento-header">
            <div className="bento-icon">
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
            <h3 className="bento-title">From Review to Terraform in One Click</h3>
          </div>
          <p className="bento-desc">
            Never let architecture designs gather dust in a wiki. Export the verified topology
            directly into production Terraform modules and Envoy Proxy filters before leaving the
            meeting.
          </p>
          <div className="bento-callout">
            <span className="callout-label">PRODUCTION-READY:</span>
            <span>Terraform (.tf) &bull; Envoy Proxy YAML &bull; Docker Compose</span>
          </div>
        </div>
      </div>
    </section>
  );
}
