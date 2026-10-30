import { useEffect, useRef, useState } from 'react';

export interface MeetingsDropdownProps {
  readonly isMeetingActive: boolean;
  readonly roomCode: string;
  readonly onOpenCreate: () => void;
  readonly onOpenJoin: () => void;
  readonly onLeaveMeeting: () => void;
  readonly onShareRoom: () => void;
}

export function MeetingsDropdown({
  isMeetingActive,
  roomCode,
  onOpenCreate,
  onOpenJoin,
  onLeaveMeeting,
  onShareRoom,
}: MeetingsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handleCopyLink = () => {
    onShareRoom();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="meetings-dropdown-wrapper" ref={menuRef}>
      {/* Navbar Meeting Trigger Button */}
      <button
        type="button"
        className={`navbar-meeting-btn ${isMeetingActive ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Architecture Review Meetings"
      >
        {isMeetingActive ? (
          <>
            <span className="live-dot-active" />
            <span className="meeting-btn-label">{roomCode || '#rfc-checkout-v2'}</span>
          </>
        ) : (
          <>
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="meeting-btn-label">Meetings</span>
          </>
        )}
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`dropdown-chevron ${isOpen ? 'rotated' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="meetings-menu" role="menu">
          {!isMeetingActive ? (
            // Idle state: Create or Join options
            <div className="menu-section">
              <button
                type="button"
                className="meetings-menu-item"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenCreate();
                }}
              >
                <div className="menu-item-icon">
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div className="menu-item-content">
                  <div className="menu-item-title">Create Meeting</div>
                  <div className="menu-item-subtitle">Host a new review room</div>
                </div>
              </button>

              <button
                type="button"
                className="meetings-menu-item"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  onOpenJoin();
                }}
              >
                <div className="menu-item-icon">
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </div>
                <div className="menu-item-content">
                  <div className="menu-item-title">Join Meeting</div>
                  <div className="menu-item-subtitle">Enter code or start solo</div>
                </div>
              </button>
            </div>
          ) : (
            // Active meeting state: Session details, participants, share & leave
            <div className="menu-section">
              <div className="active-meeting-header">
                <div>
                  <div className="active-room-title">{roomCode || '#rfc-checkout-v2'}</div>
                  <div className="active-room-status">Architecture Review Session</div>
                </div>
                <span className="live-status-pill">Active</span>
              </div>

              <div className="menu-divider" />

              <div className="menu-subheading">Participants</div>
              <div className="meeting-roster-list">
                <div className="roster-item">
                  <span className="roster-avatar host">AC</span>
                  <div className="roster-meta">
                    <span className="roster-name">Alex Chen (You)</span>
                    <span className="roster-role">Staff SRE</span>
                  </div>
                </div>
                <div className="roster-item">
                  <span className="roster-avatar">ER</span>
                  <div className="roster-meta">
                    <span className="roster-name">Elena Rostova</span>
                    <span className="roster-role">Principal Architect</span>
                  </div>
                </div>
                <div className="roster-item">
                  <span className="roster-avatar ai">AI</span>
                  <div className="roster-meta">
                    <span className="roster-name">Meta AI SRE</span>
                    <span className="roster-role">Autonomous Watcher</span>
                  </div>
                </div>
              </div>

              <div className="menu-divider" />

              <button type="button" className="meetings-menu-action" onClick={handleCopyLink}>
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Meeting Invite Link'}</span>
              </button>

              <button
                type="button"
                className="meetings-menu-action danger"
                onClick={() => {
                  setIsOpen(false);
                  onLeaveMeeting();
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
                <span>Leave Meeting</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
