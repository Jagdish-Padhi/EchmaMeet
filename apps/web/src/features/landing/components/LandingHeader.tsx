import { EchmaLogo } from '../../../components/ui/EchmaLogo';

interface LandingHeaderProps {
  readonly isAuthenticated: boolean;
  readonly theme: 'dark' | 'light';
  readonly onToggleTheme: () => void;
  readonly onLaunchStudio: () => void;
  readonly onAuthAction: (mode: 'login' | 'signup') => void;
}

export function LandingHeader({
  isAuthenticated,
  theme,
  onToggleTheme,
  onLaunchStudio,
  onAuthAction,
}: LandingHeaderProps) {
  return (
    <header className="landing-header">
      <div className="landing-header-inner">
        <div className="landing-brand">
          <div className="brand-emblem" aria-hidden="true">
            <EchmaLogo size={32} />
          </div>
          <div className="brand-title-wrap">
            <span className="landing-title">EchmaMeet</span>
          </div>
        </div>

        <nav className="landing-nav-links" aria-label="Landing page navigation">
          <a href="#meeting-room">Review Rooms</a>
          <a href="#ai-copilot">AI SRE in Meeting</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#why-switch">Why EchmaMeet</a>
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

          {isAuthenticated ? (
            <button type="button" className="landing-signup-btn" onClick={onLaunchStudio}>
              Enter Room &rarr;
            </button>
          ) : (
            <div className="landing-auth-btn-group">
              <button
                type="button"
                className="landing-signin-btn"
                onClick={() => onAuthAction('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className="landing-signup-btn"
                onClick={() => onAuthAction('signup')}
              >
                Sign Up &rarr;
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
