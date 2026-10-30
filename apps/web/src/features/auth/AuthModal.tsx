import { useState } from 'react';
import type { UserProfile } from '../board';

export interface AuthModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onAuthenticate: (user: UserProfile) => void;
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

export function AuthModal({
  isOpen,
  onClose,
  onAuthenticate,
  pendingScenarioName,
}: AuthModalProps) {
  const [selectedUser, setSelectedUser] = useState<UserProfile>(DEFAULT_STAFF_USER);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  if (!isOpen) return null;

  const handleSignIn = (user: UserProfile) => {
    setIsAuthenticating(true);
    setTimeout(() => {
      setIsAuthenticating(false);
      onAuthenticate(user);
      onClose();
    }, 350);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="sre-yield-modal-card auth-modal-card"
        style={{ maxWidth: 460, width: '92%' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* Header */}
        <div className="sre-modal-header">
          <div className="sre-agent-identity">
            <div
              className="sre-agent-emblem"
              style={{ background: 'rgba(8, 102, 255, 0.15)', borderColor: '#0866ff' }}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <div className="sre-agent-name" id="auth-modal-title">
                Enterprise Authentication
              </div>
              <div className="sre-agent-subtitle">
                Corporate SSO &bull; Production Resilience Studio
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon-close"
            onClick={onClose}
            aria-label="Close authentication modal"
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <div className="auth-modal-body" style={{ padding: '16px 20px 20px' }}>
          {pendingScenarioName && (
            <div className="auth-scenario-notice">
              <span className="auth-notice-dot" />
              <span>
                Authenticating to load <strong>{pendingScenarioName}</strong>
              </span>
            </div>
          )}

          <div className="auth-section-label">Select Identity Account</div>

          {/* Quick Identity Option 1: Alex Chen */}
          <button
            type="button"
            className={`auth-account-tile ${selectedUser.userId === DEFAULT_STAFF_USER.userId ? 'selected' : ''}`}
            onClick={() => setSelectedUser(DEFAULT_STAFF_USER)}
          >
            <div className="auth-tile-avatar">
              <span>AC</span>
              <span className="auth-online-dot" />
            </div>
            <div className="auth-tile-info">
              <div className="auth-tile-name">Alex Chen</div>
              <div className="auth-tile-meta">alex.chen@meta.internal &bull; Staff SRE</div>
            </div>
            <div className="auth-tile-badge">Meta Infra</div>
          </button>

          {/* Quick Identity Option 2: Guest SRE */}
          <button
            type="button"
            className={`auth-account-tile ${selectedUser.userId === DEMO_GUEST_USER.userId ? 'selected' : ''}`}
            onClick={() => setSelectedUser(DEMO_GUEST_USER)}
          >
            <div className="auth-tile-avatar guest">
              <span>ER</span>
              <span className="auth-online-dot" />
            </div>
            <div className="auth-tile-info">
              <div className="auth-tile-name">Elena Rostova</div>
              <div className="auth-tile-meta">elena.rostova@meta.internal &bull; AI Lead</div>
            </div>
            <div className="auth-tile-badge">Reviewer</div>
          </button>

          <div className="auth-divider">
            <span>or Corporate SSO Provider</span>
          </div>

          {/* SSO Buttons */}
          <div className="auth-sso-buttons">
            <button
              type="button"
              className="auth-sso-btn"
              onClick={() => handleSignIn(selectedUser)}
              disabled={isAuthenticating}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
              </svg>
              <span>Meta SSO (SAML Okta)</span>
            </button>

            <button
              type="button"
              className="auth-sso-btn"
              onClick={() => handleSignIn(selectedUser)}
              disabled={isAuthenticating}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>GitHub Enterprise</span>
            </button>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            className="auth-primary-submit-btn"
            onClick={() => handleSignIn(selectedUser)}
            disabled={isAuthenticating}
          >
            {isAuthenticating ? (
              <span>Authenticating SSO Token...</span>
            ) : (
              <span>Continue as {selectedUser.name} &rarr;</span>
            )}
          </button>

          <div className="auth-security-footer">
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Secured with corporate RBAC &bull; Session token cached</span>
          </div>
        </div>
      </div>
    </div>
  );
}
