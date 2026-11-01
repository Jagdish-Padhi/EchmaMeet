import { useEffect, useState, type SyntheticEvent } from 'react';
import type { UserProfile } from '../board';
import { ApiError, type ApiClient, type AuthConfigResponse } from '../../api/client';
import { isFirebaseConfigured, signInWithGoogleFirebase } from './firebase';
import { useToast } from '../toast';
import { EchmaLogo } from '../../components/ui/EchmaLogo';

export interface AuthPageProps {
  readonly onAuthenticate: (user: UserProfile) => void;
  readonly onBackToHome: () => void;
  readonly theme: 'dark' | 'light';
  readonly onToggleTheme: () => void;
  readonly initialMode?: 'login' | 'signup';
  readonly pendingScenarioName?: string | null;
  readonly api?: ApiClient;
}

export function AuthPage({
  onAuthenticate,
  onBackToHome,
  theme,
  onToggleTheme,
  initialMode = 'login',
  pendingScenarioName,
  api,
}: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOfflineServer, setIsOfflineServer] = useState(false);
  const [authConfig, setAuthConfig] = useState<AuthConfigResponse | null>(null);
  const toast = useToast();

  useEffect(() => {
    setIsLogin(initialMode === 'login');
    setError(null);
  }, [initialMode]);

  // Discover configured OAuth providers on mount
  useEffect(() => {
    if (!api) return;
    api
      .getAuthConfig()
      .then((cfg) => {
        setAuthConfig(cfg);
      })
      .catch(() => {
        // Server might be offline
      });

    // Check if returning from GitHub OAuth redirect
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      if (code) {
        setLoading(true);
        api
          .githubAuth({ code })
          .then((res) => {
            localStorage.setItem('chaosboard_token', res.token);
            // Clean up code parameter from URL
            window.history.replaceState({}, document.title, window.location.pathname);
            onAuthenticate(res.user);
          })
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'GitHub OAuth verification failed.');
          })
          .finally(() => {
            setLoading(false);
          });
      }
    }
  }, [api, onAuthenticate]);

  const handleContinueOffline = () => {
    const initials =
      fullName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'SRE';

    const user: UserProfile = {
      userId: email.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() || 'eng-alex-chen',
      name: isLogin
        ? email.includes('alex')
          ? 'Alex Chen'
          : fullName || 'SRE Reviewer'
        : fullName,
      role: isLogin ? 'Staff SRE' : 'Reviewer',
      avatar: initials,
      email: email.trim() || 'alex.chen@meta.internal',
    };
    localStorage.setItem('chaosboard_token', 'local-offline-session-token');
    onAuthenticate(user);
  };

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsOfflineServer(false);
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid corporate email address.');
      return;
    }
    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    setLoading(true);

    try {
      if (api) {
        if (isLogin) {
          const res = await api.login({ email: email.trim(), password });
          localStorage.setItem('chaosboard_token', res.token);
          onAuthenticate(res.user);
        } else {
          const res = await api.register({
            email: email.trim(),
            password,
            name: fullName.trim() || undefined,
          });
          localStorage.setItem('chaosboard_token', res.token);
          onAuthenticate(res.user);
        }
      } else {
        handleContinueOffline();
      }
    } catch (err: unknown) {
      let errorMsg = 'Authentication failed. Please verify credentials.';
      if (err instanceof ApiError && err.failure.kind === 'problem' && err.failure.problem.detail) {
        errorMsg = err.failure.problem.detail;
      } else if (err instanceof Error) {
        errorMsg = err.message;
        if (
          errorMsg.includes('502') ||
          errorMsg.includes('offline') ||
          errorMsg.includes('network') ||
          errorMsg.includes('Failed to fetch')
        ) {
          setIsOfflineServer(true);
        }
      }
      setError(errorMsg);
      toast.error(errorMsg, isLogin ? 'Sign-In Failed' : 'Registration Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSsoLogin = async (provider: 'google' | 'github') => {
    setLoading(true);
    setError(null);
    setIsOfflineServer(false);
    try {
      if (api) {
        // If Google and Firebase is configured, sign in with real Firebase Google popup
        if (provider === 'google' && isFirebaseConfigured) {
          const firebaseUser = await signInWithGoogleFirebase();
          const res = await api.googleAuth({
            idToken: firebaseUser.idToken,
            profile: {
              email: firebaseUser.email,
              name: firebaseUser.name,
              avatar: firebaseUser.photoUrl,
            },
          });
          localStorage.setItem('chaosboard_token', res.token);
          onAuthenticate(res.user);
          return;
        }

        // If real GitHub OAuth client ID is configured and user clicks GitHub
        if (provider === 'github' && authConfig?.githubClientId) {
          const redirectUri = window.location.origin + window.location.pathname;
          window.location.href = `https://github.com/login/oauth/authorize?client_id=${authConfig.githubClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user,user:email`;
          return;
        }

        // If SSO is not configured, inform the user cleanly instead of faking a login
        const providerName = provider === 'google' ? 'Google Workspace' : 'GitHub Enterprise';
        toast.info(
          `${providerName} Single Sign-On is not configured on this server. Please enter your credentials or use the offline mode below.`,
          'SSO Configuration',
        );
        setError(`${providerName} SSO is not configured. Please sign in with email and password.`);
        return;
      } else {
        toast.info(
          'API server is not connected. Enter your name and email to continue in local offline session.',
          'Offline Mode',
        );
        handleContinueOffline();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `${provider} SSO failed. Please try again.`;
      setError(msg);
      if (msg.includes('502') || msg.includes('offline') || msg.includes('network')) {
        setIsOfflineServer(true);
      }
      toast.error(msg, `${provider.toUpperCase()} Sign-In Failed`);
    } finally {
      setLoading(false);
    }
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
            {/* EchmaMeet Logo Emblem */}
            <div className="auth-brand-logo-wrap">
              <EchmaLogo size={76} />
            </div>

            {/* Brand Title */}
            <div className="auth-brand-title">
              <span className="auth-brand-white">Echma</span>
              <span className="auth-brand-gradient">Meet</span>
            </div>

            <p className="auth-clean-tagline">Ready to break it before production does?</p>
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
                  : 'Join EchmaMeet to design, chaos-test, and auto-repair systems'}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span>{error}</span>
                  {isOfflineServer && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                      onClick={handleContinueOffline}
                    >
                      Continue in Standalone Mode &rarr;
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Interactive Form */}
            <form
              onSubmit={(e) => {
                void handleSubmit(e);
              }}
              className="auth-fields-form"
            >
              {!isLogin && (
                <div className="auth-field-group">
                  <label className="auth-field-label" htmlFor="auth-fullname">
                    Full Name
                  </label>
                  <input
                    id="auth-fullname"
                    type="text"
                    placeholder="Your name"
                    className="auth-input-control"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="auth-field-group">
                <label className="auth-field-label" htmlFor="auth-email">
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  placeholder="you@company.com"
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
                </div>
                <div className="auth-password-wrapper">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
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
                onClick={() => {
                  void handleSsoLogin('google');
                }}
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
                onClick={() => {
                  void handleSsoLogin('github');
                }}
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
