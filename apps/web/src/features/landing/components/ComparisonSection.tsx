export function ComparisonSection() {
  return (
    <section id="why-switch" className="landing-section">
      <div className="section-header">
        <span className="section-eyebrow">WHY ECHMAMEET</span>
        <h2 className="section-title">Built for Engineering Teams That Value Reliability</h2>
        <p className="section-desc">
          Give your staff engineers and architects complete confidence before deploying new
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
            <h3 className="bento-title">Consensus Through Evidence, Not Status</h3>
          </div>
          <p className="bento-desc">
            Instead of the most senior engineer in the room winning an argument by default,
            EchmaMeet lets teams simulate the failure mode live. Facts settle architectural debates
            in 5 minutes.
          </p>
          <div className="bento-callout">
            <span className="callout-label">EVIDENCE-BASED:</span>
            <span>Test the proposal against real chaos live in the meeting room.</span>
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
            <h3 className="bento-title">Eliminate 3 AM Outages</h3>
          </div>
          <p className="bento-desc">
            Most P0 outages are caused by cascading retries and missing timeouts. Catch them in the
            design review meeting before writing production code.
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
            Give every development squad access to principal reliability engineering expertise with
            an autonomous AI SRE actively participating in design reviews.
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
  );
}
