import { useEffect, useRef, useState } from 'react';

export interface UserProfile {
  readonly userId: string;
  readonly name: string;
  readonly role: string;
  readonly avatar: string;
  readonly email?: string | undefined;
}

export interface UserProfileMenuProps {
  readonly user: UserProfile;
  readonly onOpenSettings: () => void;
  readonly onSignOut: () => void;
}

export function UserProfileMenu({ user, onOpenSettings, onSignOut }: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [isOpen]);

  const email = user.email ?? `${user.userId}@local.session`;

  return (
    <div
      className="user-profile-menu-wrapper"
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className="user-avatar-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={`${user.name} (${user.role}) - Account & Settings`}
      >
        <span className="user-avatar-initials">{user.avatar}</span>
        <span className="user-status-dot" />
      </button>

      {isOpen && (
        <div className="user-profile-dropdown" role="menu">
          {/* User Profile Card Header */}
          <div className="profile-dropdown-header">
            <div className="profile-header-avatar">
              <span>{user.avatar}</span>
            </div>
            <div className="profile-header-info">
              <div className="profile-user-name">{user.name}</div>
              <div className="profile-user-email">{email}</div>
              <div className="profile-role-badge">{user.role}</div>
            </div>
          </div>

          <div className="dropdown-separator" />

          {/* Actions */}
          <div className="profile-dropdown-section">
            <button
              type="button"
              className="profile-menu-action"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onOpenSettings();
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0 1.51 1z" />
              </svg>
              <span>Settings</span>
            </button>
          </div>

          <div className="dropdown-separator" />

          {/* Sign Out Action */}
          <div className="profile-dropdown-section">
            <button
              type="button"
              className="profile-menu-action sign-out"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onSignOut();
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
