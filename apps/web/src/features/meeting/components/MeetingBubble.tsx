export interface MeetingBubbleProps {
  readonly roomCode: string;
  readonly totalParticipants: number;
  readonly isSpeaking: boolean;
  readonly isMuted: boolean;
  readonly onExpandFloating: () => void;
  readonly onExpandFullscreen: () => void;
  readonly onOpenLeaveModal: () => void;
}

export function MeetingBubble({
  roomCode,
  totalParticipants,
  isSpeaking,
  isMuted,
  onExpandFloating,
  onExpandFullscreen,
  onOpenLeaveModal,
}: MeetingBubbleProps) {
  return (
    <aside
      className="meeting-pip-bubble"
      onClick={onExpandFloating}
      role="button"
      tabIndex={0}
      aria-label="Expand Google Meet review window"
      title="Click to expand architecture review call"
    >
      <span className="pip-live-pulse" />
      <span className="pip-bubble-title">{roomCode || '#rfc-checkout-v2'}</span>

      {/* Real Audio Volume Wave Indicator in Bubble */}
      {isSpeaking && !isMuted ? (
        <span className="pip-audio-speaking-dot" title="Speaking..." />
      ) : isMuted ? (
        <span className="pip-bubble-muted-tag" title="Microphone muted">
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
      ) : null}

      <span className="pip-badge-count">{totalParticipants}</span>

      {/* Quick Expand Button */}
      <button
        type="button"
        className="pip-expand-btn"
        onClick={(e) => {
          e.stopPropagation();
          onExpandFloating();
        }}
        title="Expand to floating window"
        aria-label="Expand"
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

      {/* Quick Enlarge Fullscreen Button */}
      <button
        type="button"
        className="pip-expand-btn"
        onClick={(e) => {
          e.stopPropagation();
          onExpandFullscreen();
        }}
        title="Enlarge to full screen (Google Meet)"
        aria-label="Full screen"
      >
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      </button>

      {/* Quick Leave Button */}
      <button
        type="button"
        className="pip-bubble-end-btn"
        onClick={(e) => {
          e.stopPropagation();
          onOpenLeaveModal();
        }}
        title="End / Leave Call"
        aria-label="Leave call"
      >
        &times;
      </button>
    </aside>
  );
}
