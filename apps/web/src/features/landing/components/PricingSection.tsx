interface PricingSectionProps {
  readonly billingCycle: 'monthly' | 'annual';
  readonly onBillingCycleChange: (cycle: 'monthly' | 'annual') => void;
  readonly onAuthAction: (mode: 'login' | 'signup') => void;
}

export function PricingSection({
  billingCycle,
  onBillingCycleChange,
  onAuthAction,
}: PricingSectionProps) {
  return (
    <section id="pricing" className="landing-section">
      <div className="section-header">
        <span className="section-eyebrow">PRICING</span>
        <h2 className="section-title">Simple, Team-First Pricing</h2>
        <p className="section-desc">
          Start free with your own sandbox. Upgrade when your team wants collaborative review rooms
          with the AI SRE copilot.
        </p>

        <div className="billing-switcher-wrap">
          <button
            type="button"
            className={`billing-cycle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
            onClick={() => onBillingCycleChange('monthly')}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            className={`billing-cycle-btn ${billingCycle === 'annual' ? 'active' : ''}`}
            onClick={() => onBillingCycleChange('annual')}
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
            onClick={() => onAuthAction('signup')}
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
                <span>&#10003;</span> Community support &amp; templates
              </li>
            </ul>
          </div>
        </div>

        {/* Plan 2: Team Pro */}
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
            onClick={() => onAuthAction('signup')}
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
                <span>&#10003;</span> Autonomous AI SRE active meeting participant &amp; fix
                suggestions
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
            onClick={() => onAuthAction('signup')}
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
  );
}
