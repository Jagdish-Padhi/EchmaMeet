import { useState } from 'react';
import type { SreHazard } from './types';

export interface MeetingBarProps {
  readonly aiRaisedHand: boolean;
  readonly hazards: readonly SreHazard[];
  readonly onYieldFloor: () => void;
  readonly onShareRoom: () => void;
}

export function MeetingBar({ aiRaisedHand, hazards, onYieldFloor, onShareRoom }: MeetingBarProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    onShareRoom();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="meeting-bar-container">
      {/* Active Attendees Huddle Dock */}
      <div className="meeting-attendees-group">
        <div className="attendee-avatar" title="Sarah Chen (Staff SRE)">
          <span>SC</span>
        </div>
        <div className="attendee-avatar" title="Alex Miller (Lead Architect)">
          <span>AM</span>
        </div>
        <div
          className={`attendee-avatar ai-avatar ${aiRaisedHand ? 'ai-raised-hand' : ''}`}
          title="ChaosBoard AI SRE (Meta Spark Open)"
        >
          <span>🤖</span>
          {aiRaisedHand && <div className="hand-badge">✋</div>}
        </div>
      </div>

      {/* SRE Meeting Etiquette Action Pill */}
      {aiRaisedHand ? (
        <button
          type="button"
          className="yield-floor-btn"
          onClick={onYieldFloor}
          title="Yield meeting floor to ChaosBoard AI SRE"
        >
          <span className="pulse-hand">✋</span>
          <span className="hazard-count-badge">{hazards.length}</span>
          <span>Yield Floor to AI</span>
        </button>
      ) : (
        <div className="ai-status-listening">
          <span className="listening-dot" />
          <span>Meta AI SRE Monitoring</span>
        </div>
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
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        <span>{copied ? 'Copied Link!' : 'Share Room'}</span>
      </button>
    </div>
  );
}
