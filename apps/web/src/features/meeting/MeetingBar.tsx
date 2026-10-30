import { useState } from 'react';
import type { SreHazard } from './types';

export interface MeetingBarProps {
  readonly isConnected: boolean;
  readonly onToggleConnect: () => void;
  readonly aiRaisedHand: boolean;
  readonly hazards: readonly SreHazard[];
  readonly onYieldFloor: () => void;
  readonly onShareRoom: () => void;
}

export function MeetingBar({
  isConnected,
  onToggleConnect,
  aiRaisedHand,
  hazards,
  onYieldFloor,
  onShareRoom,
}: MeetingBarProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    onShareRoom();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isConnected) {
    return (
      <button
        type="button"
        className="btn-live-session-start"
        onClick={onToggleConnect}
        title="Start live Architecture Review session with Meta AI SRE"
      >
        <span className="live-dot-idle" />
        <span>Live Review</span>
      </button>
    );
  }

  return (
    <div className="meeting-bar-container">
      {/* Active Session Indicator */}
      <div className="meeting-session-badge">
        <span className="live-dot-active" />
        <span className="meeting-room-name">Live Review</span>
      </div>

      {/* Meta AI SRE Agent Status */}
      <div
        className={`meeting-ai-badge ${aiRaisedHand ? 'meeting-ai-alert' : ''}`}
        title="Meta AI SRE Agent"
      >
        <svg
          viewBox="0 0 24 24"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="12" cy="5" r="2" />
          <path d="M12 7v4" />
          <line x1="8" y1="16" x2="8" y2="16" />
          <line x1="16" y1="16" x2="16" y2="16" />
        </svg>
        <span>Meta AI SRE</span>
      </div>

      {/* SRE Action Button when Hand Raised */}
      {aiRaisedHand && (
        <button
          type="button"
          className="yield-floor-btn"
          onClick={onYieldFloor}
          title="Review architectural risk detected by Meta AI SRE"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <path d="M18 11V6a2 2 0 0 0-4 0v5" />
            <path d="M14 10V4a2 2 0 0 0-4 0v7" />
            <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
            <path d="M6 14v-1a2 2 0 0 0-4 0v6a6 6 0 0 0 6 6h4a6 6 0 0 0 6-6v-4a2 2 0 0 0-4 0" />
          </svg>
          <span className="hazard-count-badge">{hazards.length}</span>
          <span>Review AI Finding</span>
        </button>
      )}

      {/* Share Room Button */}
      <button
        type="button"
        className="btn-share-room"
        onClick={handleShare}
        title="Copy shareable Architecture Review Room URL"
      >
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        <span>{copied ? 'Copied' : 'Share'}</span>
      </button>

      {/* Leave Session */}
      <button
        type="button"
        className="btn-leave-room"
        onClick={onToggleConnect}
        title="Leave collaborative review session"
      >
        Leave
      </button>
    </div>
  );
}
