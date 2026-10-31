import { useState, type SyntheticEvent } from 'react';
import type { UserProfile } from '../board';

export interface AuthPageProps {
  readonly onAuthenticate: (user: UserProfile) => void;
  readonly onBackToHome: () => void;
  readonly theme: 'dark' | 'light';
  readonly onToggleTheme: () => void;
  readonly initialMode?: 'login' | 'signup';
  readonly pendingScenarioName?: string | null;
}

const DEFAULT_STAFF_USER: UserProfile = {
  userId: 'eng-alex-chen',
  name: 'Alex Chen',
  role: 'Staff SRE',
  avatar: 'AC',
  email: 'alex.chen@meta.internal',
};

const DEMO_GUEST_USER: UserProfile = {
  userId: 'eng-guest-reviewer',
  name: 'Elena Rostova',
  role: 'Meta AI SRE Partner',
  avatar: 'ER',
  email: 'elena.rostova@meta.internal',
};

export function AuthPage({
  onAuthenticate,
  onBackToHome,
  theme,
  onToggleTheme,
  initialMode = 'login',
  pendingScenarioName,
}: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [fullName, setFullName] = useState('Alex Chen');
  const [role, setRole] = useState('Staff SRE • Infrastructure');
  const [email, setEmail] = useState('alex.chen@meta.internal');
  const [password, setPassword] = useState('••••••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Please provide a valid corporate email address.');
      return;
    }
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      const initials =
        fullName
          .split(' ')
          .map((p) => p[0])
          .join('')
          .toUpperCase()
          .slice(0, 2) || 'SRE';

      const user: UserProfile = {
        userId: email.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
        name: isLogin
          ? email.includes('alex')
            ? 'Alex Chen'
            : fullName || 'SRE Engineer'
          : fullName,
        role: isLogin ? 'Staff SRE' : role || 'Site Reliability Engineer',
        avatar: initials,
        email: email.trim(),
      };
      onAuthenticate(user);
    }, 400);
  };

  const handleQuickLogin = (user: UserProfile) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onAuthenticate(user);
    }, 250);
  };

  const handleSsoLogin = (provider: 'google' | 'github') => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const user: UserProfile = {
        userId: `sso-${provider}-eng`,
        name: provider === 'github' ? 'Staff Engineer (GitHub)' : 'Alex Chen (Google SSO)',
        role: 'Distributed Systems Architect',
        avatar: provider === 'github' ? 'GH' : 'AC',
        email: provider === 'github' ? 'eng@github.sso' : 'alex.chen@google.sso',
      };
      onAuthenticate(user);
    }, 350);
  };

  return (
    <div className="auth-page-root">
      {/* Deep Ambient Reflection & Mesh Glow */}
      <div className="auth-ambient-glow" aria-hidden="true" />

      {/* Top Left: Back to Home Link */}
      <div className="auth-top-nav-left">
        <button
          type="button"
          onClick={onBackToHome}
          className="auth-back-btn"
          aria-label="Return to landing page"
        >
          <svg
            className="auth-back-arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back to Home</span>
        </button>
      </div>

      {/* Top Right: Theme Toggle */}
      <div className="auth-top-nav-right">
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
      </div>

      {/* Main Container: 1 Box Divided in 2 Parts (Matching HackDekh Architecture) */}
      <div className="auth-split-card">
        {/* Left Brand Side */}
        <div className="auth-brand-side">
          {/* Subtle Ambient Glows */}
          <div className="auth-glow-top-left" aria-hidden="true" />
          <div className="auth-glow-bottom-right" aria-hidden="true" />

          <div className="auth-brand-content">
            {/* Resilio Logo Emblem */}
            <div className="auth-brand-logo-wrap">
              <svg viewBox="0 0 32 32" width="60" height="60" fill="none">
                <defs>
                  <linearGradient id="brandHexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="50%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#c084fc" />
                  </linearGradient>
                </defs>
                <rect width="32" height="32" rx="8" fill="#0b0f19" />
                <polygon
                  points="16,4 28,11 28,25 16,30 4,25 4,11"
                  fill="none"
                  stroke="url(#brandHexGrad)"
                  strokeWidth="2.2"
                />
                <circle cx="16" cy="17" r="4" fill="#38bdf8" />
                <circle
                  cx="16"
                  cy="17"
                  r="7"
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
              </svg>
            </div>

            {/* Brand Title */}
            <div className="auth-brand-title">
              <span className="auth-brand-white">Resil</span>
              <span className="auth-brand-gradient">io</span>
            </div>

            {/* Tagline Lockup with Scribble Underline (Matching HackDekh Aesthetic) */}
            <div className="auth-brand-tagline-lockup">
              <span className="auth-tagline-heading">Resilience First.</span>
              <span className="auth-tagline-highlight-wrap">
                <span className="auth-tagline-highlight">Zero Downtime.</span>
                {/* Handwritten Pen Scribble Underline */}
                <svg
                  viewBox="0 0 200 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="auth-scribble-svg"
                  aria-hidden="true"
                >
                  <path
                    d="M 2 6 C 38 3, 100 3, 198 5 C 148 8.5, 68 11, 14 13 C 70 12, 142 10, 192 11"
                    stroke="url(#authScribbleGrad)"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <defs>
                    <linearGradient
                      id="authScribbleGrad"
                      x1="0"
                      y1="0"
                      x2="200"
                      y2="0"
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="50%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#c084fc" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
              <p className="auth-brand-description">
                Design-time chaos testing &amp; autonomous self-healing for mission-critical
                distributed architectures.
              </p>
            </div>

            {/* Enterprise Security Pill Badges */}
            <div className="auth-trust-badges">
              <div className="auth-trust-pill">
                <svg
                  viewBox="0 0 24 24"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.5"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>SOC-2 Type II Certified</span>
              </div>
              <div className="auth-trust-pill">
                <svg
                  viewBox="0 0 24 24"
                  width="12"
                  height="12"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Meta SSO &amp; RBAC Guarded</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Side */}
        <div className="auth-form-side">
          <div className="auth-form-inner">
            {/* Header Title */}
            <div className="auth-form-header">
              <h1 className="auth-form-title">{isLogin ? 'Welcome back' : 'Create an account'}</h1>
              <p className="auth-form-subtitle">
                {isLogin
                  ? 'Enter your credentials to access your architecture workspace'
                  : 'Join Resilio to design, chaos-test, and auto-repair systems'}
              </p>
            </div>

            {/* Pending Scenario Notice */}
            {pendingScenarioName && (
              <div className="auth-scenario-notice">
                <span className="auth-notice-dot" />
                <span>
                  Target Scenario: <strong>{pendingScenarioName}</strong>
                </span>
              </div>
            )}

            {/* Feedback Error Banner */}
            {error && (
              <div className="auth-error-banner" role="alert">
                {error}
              </div>
            )}

            {/* Interactive Form */}
            <form onSubmit={handleSubmit} className="auth-fields-form">
              {!isLogin && (
                <>
                  <div className="auth-field-group">
                    <label className="auth-field-label" htmlFor="auth-fullname">
                      Full Name
                    </label>
                    <input
                      id="auth-fullname"
                      type="text"
                      placeholder="Alex Chen"
                      className="auth-input-control"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="auth-field-group">
                    <label className="auth-field-label" htmlFor="auth-role">
                      Staff Role / Team
                    </label>
                    <input
                      id="auth-role"
                      type="text"
                      placeholder="Staff SRE • Infrastructure"
                      className="auth-input-control"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="auth-field-group">
                <label className="auth-field-label" htmlFor="auth-email">
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  placeholder="alex.chen@meta.internal"
                  className="auth-input-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="auth-field-group">
                <div className="auth-password-header">
                  <label className="auth-field-label" htmlFor="auth-password">
                    Password
                  </label>
                  {isLogin && <span className="auth-password-sso-hint">Corporate SSO</span>}
                </div>
                <div className="auth-password-wrapper">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    className="auth-input-control auth-password-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="auth-password-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
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
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn-brand-primary auth-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <span className="auth-btn-loading-state">
                    <svg className="auth-spinner" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Authenticating...</span>
                  </span>
                ) : (
                  <span>{isLogin ? 'Sign In to Workspace' : 'Create Free Account'}</span>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="auth-divider-line">
              <span className="auth-divider-text">OR</span>
            </div>

            {/* Social SSO Buttons */}
            <div className="auth-social-row">
              <button
                type="button"
                onClick={() => handleSsoLogin('google')}
                disabled={loading}
                className="auth-social-button"
              >
                <svg className="auth-social-icon" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => handleSsoLogin('github')}
                disabled={loading}
                className="auth-social-button"
              >
                <svg className="auth-social-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span>GitHub</span>
              </button>
            </div>

            {/* Quick Staff SRE Profiles Fast-Pass */}
            <div className="auth-fast-pass-section">
              <div className="auth-fast-pass-title">One-Click Staff SRE Passes</div>
              <div className="auth-fast-pass-grid">
                <button
                  type="button"
                  onClick={() => handleQuickLogin(DEFAULT_STAFF_USER)}
                  disabled={loading}
                  className="auth-fast-pass-btn"
                >
                  <span className="auth-fast-pass-avatar staff">AC</span>
                  <div className="auth-fast-pass-info">
                    <span className="auth-fast-pass-name">Alex Chen</span>
                    <span className="auth-fast-pass-role">Staff SRE &bull; Meta Infra</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin(DEMO_GUEST_USER)}
                  disabled={loading}
                  className="auth-fast-pass-btn"
                >
                  <span className="auth-fast-pass-avatar ai">ER</span>
                  <div className="auth-fast-pass-info">
                    <span className="auth-fast-pass-name">Elena Rostova</span>
                    <span className="auth-fast-pass-role">Meta AI SRE Partner</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Footer Toggle Mode */}
            <div className="auth-footer-toggle">
              {isLogin ? (
                <>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(false);
                      setError(null);
                    }}
                    className="auth-mode-toggle-link"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(true);
                      setError(null);
                    }}
                    className="auth-mode-toggle-link"
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
