import { useEffect, useRef, useState } from 'react';
import { AlreadyInCallModal } from './AlreadyInCallModal';

export interface MeetingsDropdownProps {
  readonly isMeetingActive: boolean;
  readonly roomCode: string;
  readonly onOpenCreate: () => void;
  readonly onOpenJoin: () => void;
  readonly onLeaveMeeting?: () => void;
  readonly onShareRoom?: () => void;
  readonly currentUser?: {
    readonly name: string;
    readonly role: string;
    readonly avatar: string;
  };
  readonly remoteReviewers?: readonly {
    readonly name: string;
    readonly role: string;
    readonly avatar: string;
  }[];
  readonly onFocusMeeting?: () => void;
}

export function MeetingsDropdown({
  isMeetingActive,
  roomCode,
  onOpenCreate,
  onOpenJoin,
  onLeaveMeeting,
  onFocusMeeting,
}: MeetingsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAlreadyInCallOpen, setIsAlreadyInCallOpen] = useState(false);
  const [attemptedAction, setAttemptedAction] = useState<'create' | 'join'>('create');
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

  const handleActionClick = (action: 'create' | 'join') => {
    setIsOpen(false);
    if (isMeetingActive) {
      setAttemptedAction(action);
      setIsAlreadyInCallOpen(true);
      return;
    }
    if (action === 'create') {
      onOpenCreate();
    } else {
      onOpenJoin();
    }
  };

  const handleLeaveAndProceed = () => {
    setIsAlreadyInCallOpen(false);
    onLeaveMeeting?.();
    if (attemptedAction === 'create') {
      onOpenCreate();
    } else {
      onOpenJoin();
    }
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
        title={isMeetingActive ? `Active Meeting: ${roomCode}` : 'Architecture Review Meetings'}
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

      {/* Floating Dropdown Menu - Clean standard options */}
      {isOpen && (
        <div className="meetings-menu" role="menu">
          <div className="menu-section">
            <button
              type="button"
              className="meetings-menu-item"
              role="menuitem"
              onClick={() => handleActionClick('create')}
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
              onClick={() => handleActionClick('join')}
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
        </div>
      )}

      {/* Already in a call warning popup modal */}
      <AlreadyInCallModal
        isOpen={isAlreadyInCallOpen}
        roomCode={roomCode || '#rfc-checkout-v2'}
        attemptedAction={attemptedAction}
        onClose={() => {
          setIsAlreadyInCallOpen(false);
          onFocusMeeting?.();
        }}
        onLeaveAndProceed={onLeaveMeeting ? handleLeaveAndProceed : undefined}
      />
    </div>
  );
}
