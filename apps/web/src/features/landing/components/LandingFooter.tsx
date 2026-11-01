import { EchmaLogo } from '../../../components/ui/EchmaLogo';

interface LandingFooterProps {
  readonly onLaunchStudio: () => void;
  readonly onAuthAction: (mode: 'login' | 'signup') => void;
}

export function LandingFooter({ onLaunchStudio, onAuthAction }: LandingFooterProps) {
  return (
    <>
      <section className="landing-cta-banner-wrap">
        <div className="landing-cta-banner">
          <h2 className="cta-banner-title">Stop Debating Architecture in the Dark.</h2>
          <p className="cta-banner-desc">
            Run your next architecture review in EchmaMeet. Join on voice, test live chaos, and let
            an AI SRE catch failure loops before you deploy.
          </p>
          <div className="cta-banner-actions">
            <button type="button" className="btn btn-primary btn-hero" onClick={onLaunchStudio}>
              Start Free Review Room &rarr;
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-hero"
              onClick={() => onAuthAction('signup')}
            >
              Sign Up for Free
            </button>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="footer-columns-grid">
            <div className="footer-brand-col">
              <div className="landing-brand">
                <div className="brand-emblem" aria-hidden="true">
                  <EchmaLogo size={30} />
                </div>
                <span className="landing-title">EchmaMeet</span>
              </div>
              <p className="footer-tagline">
                The Real-Time Collaborative Architecture Review Room with Autonomous AI SRE Copilot.
              </p>
            </div>

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

            <div className="footer-col">
              <h4 className="footer-col-title">Trust &amp; Legal</h4>
              <ul className="footer-col-links">
                <li>
                  <a href="#pricing">Security Architecture</a>
                </li>
                <li>
                  <a href="#pricing">Compliance Standards</a>
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
              &copy; 2026 EchmaMeet Technologies Inc. All rights reserved.
            </span>
            <div className="footer-compliance-badges">
              <span>End-to-End Encrypted (TLS 1.3)</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
