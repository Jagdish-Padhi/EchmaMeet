import { useState } from 'react';

export interface FloatingMeetingPiPProps {
  readonly isActive: boolean;
  readonly roomCode: string;
  readonly aiRaisedHand: boolean;
  readonly onOpenSreFinding: () => void;
  readonly onLeaveMeeting: () => void;
}

export function FloatingMeetingPiP({
  isActive,
  roomCode,
  aiRaisedHand,
  onOpenSreFinding,
  onLeaveMeeting,
}: FloatingMeetingPiPProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);

  if (!isActive) return null;

  // Minimized state: sleek floating pill at bottom-right
  if (isMinimized) {
    return (
      <aside
        className="meeting-pip-bubble"
        onClick={() => setIsMinimized(false)}
        role="button"
        tabIndex={0}
        aria-label="Expand Google Meet review window"
        title="Click to expand Google Meet window"
      >
        <span className="pip-live-pulse" />
        <span className="pip-bubble-title">{roomCode || '#rfc-checkout-v2'}</span>
        <span className="pip-badge-count">3</span>
        <button
          type="button"
          className="pip-expand-btn"
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(false);
          }}
          aria-label="Expand window"
        >
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </aside>
    );
  }

  // Expanded state: Google Meet-style floating PiP window
  return (
    <aside
      className="meeting-pip-window"
      aria-label="Active Google Meet Architecture Review Window"
      role="region"
    >
      {/* Window Titlebar */}
      <div className="pip-window-header">
        <div className="pip-header-left">
          <span className="pip-live-pulse" />
          <span className="pip-window-title">{roomCode || '#rfc-checkout-v2'}</span>
        </div>
        <div className="pip-header-controls">
          <button
            type="button"
            className="pip-control-icon-btn"
            onClick={() => setIsMinimized(true)}
            title="Minimize to floating bubble"
            aria-label="Minimize"
          >
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Meet 3-Tile Grid (2 Peers + Meta AI SRE) */}
      <div className="pip-video-grid">
        {/* Peer 1: Elena Rostova (Speaking) */}
        <div className="pip-tile tile-peer">
          <div className="pip-avatar-wrap speaking">
            <span className="pip-avatar-text">ER</span>
          </div>
          <div className="pip-tile-meta">
            <span className="pip-tile-name">Elena Rostova</span>
            <span className="pip-speaking-bars" aria-hidden="true">
              <span className="bar" />
              <span className="bar" />
              <span className="bar" />
            </span>
          </div>
        </div>

        {/* Peer 2: Meta AI SRE (Watcher) */}
        <div className="pip-tile tile-ai">
          <div className="pip-avatar-wrap ai-pulse">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          </div>
          <div className="pip-tile-meta">
            <span className="pip-tile-name ai">Meta AI SRE</span>
            {aiRaisedHand && <span className="pip-alert-dot" title="Risk identified" />}
          </div>
        </div>

        {/* Self: Alex Chen (You) */}
        <div className="pip-tile tile-self">
          <div className="pip-avatar-wrap self">
            {isVideoOn ? (
              <span className="pip-avatar-text">AC</span>
            ) : (
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            )}
          </div>
          <div className="pip-tile-meta">
            <span className="pip-tile-name">You (Staff SRE)</span>
            {isMuted && (
              <span className="pip-mic-muted-icon" title="Microphone muted">
                <svg
                  viewBox="0 0 24 24"
                  width="10"
                  height="10"
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth="2.5"
                >
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                </svg>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Floating Google Meet Bottom Control Bar */}
      <div className="pip-controls-bar">
        {/* Mic Toggle */}
        <button
          type="button"
          className={`pip-action-btn ${isMuted ? 'muted' : ''}`}
          onClick={() => setIsMuted((prev) => !prev)}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? (
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {/* Cam Toggle */}
        <button
          type="button"
          className={`pip-action-btn ${!isVideoOn ? 'muted' : ''}`}
          onClick={() => setIsVideoOn((prev) => !prev)}
          title={isVideoOn ? 'Turn camera off' : 'Turn camera on'}
          aria-label={isVideoOn ? 'Turn camera off' : 'Turn camera on'}
        >
          {isVideoOn ? (
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          )}
        </button>

        {/* Hand Raise / AI Finding Trigger */}
        <button
          type="button"
          className={`pip-action-btn ${aiRaisedHand ? 'highlight' : ''}`}
          onClick={onOpenSreFinding}
          title="Review Meta AI SRE analysis findings"
          aria-label="Review findings"
        >
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 11V6a2 2 0 0 0-4 0v5" />
            <path d="M14 10V4a2 2 0 0 0-4 0v7" />
            <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
            <path d="M6 14v-1a2 2 0 0 0-4 0v6a6 6 0 0 0 6 6h4a6 6 0 0 0 6-6v-4a2 2 0 0 0-4 0" />
          </svg>
        </button>

        {/* Red Leave Call Phone Button */}
        <button
          type="button"
          className="pip-action-btn end-call"
          onClick={onLeaveMeeting}
          title="Leave architecture review call"
          aria-label="Leave call"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.39.39.39 1.02 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
