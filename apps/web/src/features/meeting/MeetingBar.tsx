import { useState } from 'react';
import type { SreHazard } from './types';

export interface MeetingParticipant {
  readonly id: string;
  readonly name: string;
  readonly role: 'Staff SRE' | 'Tech Lead' | 'Principal Architect' | 'Meta AI SRE';
  readonly avatar: string;
  readonly isSpeaking?: boolean;
  readonly isMuted?: boolean;
}

export interface MeetingBarProps {
  readonly isConnected: boolean;
  readonly onToggleConnect: () => void;
  readonly aiRaisedHand: boolean;
  readonly hazards: readonly SreHazard[];
  readonly onYieldFloor: () => void;
  readonly onShareRoom: () => void;
  readonly remoteParticipants?: readonly MeetingParticipant[];
}

export function MeetingBar({
  isConnected,
  onToggleConnect,
  aiRaisedHand,
  hazards,
  onYieldFloor,
  onShareRoom,
  remoteParticipants = [],
}: MeetingBarProps) {
  const [copied, setCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState<MeetingParticipant>({
    id: 'user-1',
    name: 'Alex Chen',
    role: 'Staff SRE',
    avatar: 'AC',
    isSpeaking: false,
    isMuted: false,
  });

  const participants: readonly MeetingParticipant[] = [
    { ...currentUser, isMuted },
    ...remoteParticipants,
    {
      id: 'ai-sre',
      name: 'Meta AI SRE',
      role: 'Meta AI SRE',
      avatar: 'AI',
      isSpeaking: aiRaisedHand,
      isMuted: false,
    },
  ];

  const handleShare = () => {
    onShareRoom();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectRole = (name: string, role: MeetingParticipant['role'], avatar: string) => {
    setCurrentUser((prev) => ({ ...prev, name, role, avatar }));
    setShowPersonaMenu(false);
  };

  if (!isConnected) {
    return (
      <div className="meeting-join-wrapper">
        <button
          type="button"
          className="btn-live-session-start"
          onClick={onToggleConnect}
          title="Join live Google Meet / Architecture Review Call"
        >
          <span className="live-dot-idle" />
          <span>Join Review Huddle</span>
        </button>
      </div>
    );
  }

  return (
    <div className="meeting-huddle-bar" role="toolbar" aria-label="Live Review Huddle Controls">
      {/* Session Channel Status */}
      <div className="huddle-room-badge">
        <span className="live-dot-active" />
        <span className="huddle-room-name">
          #rfc-checkout-v2 &bull; Architecture Review Session
        </span>
      </div>

      {/* Enterprise Reviewer Persona Stack */}
      <div className="huddle-participants-stack">
        {participants.map((p) => {
          const isAI = p.id === 'ai-sre';
          const isCurrent = p.id === currentUser.id;
          return (
            <div
              key={p.id}
              className={`huddle-avatar-chip ${isAI ? 'ai' : ''} ${p.isSpeaking ? 'speaking' : ''}`}
              title={`${p.name} (${p.role})${p.isMuted ? ' - Muted' : ''}`}
            >
              <span className="avatar-label">{p.avatar}</span>
              {p.isMuted && <span className="avatar-muted-badge" />}
              {isCurrent && <span className="avatar-current-dot" />}
            </div>
          );
        })}

        {/* Change Role Persona Trigger */}
        <div className="huddle-persona-dropdown-wrap">
          <button
            type="button"
            className="btn-persona-switch"
            onClick={() => setShowPersonaMenu((prev) => !prev)}
            title="Switch your reviewer persona"
          >
            Switch Persona &darr;
          </button>

          {showPersonaMenu && (
            <div className="persona-menu-panel">
              <div className="persona-menu-header">Select Perspective</div>
              <button
                type="button"
                className="persona-option"
                onClick={() => handleSelectRole('Alex Chen', 'Staff SRE', 'AC')}
              >
                <strong>Alex Chen</strong> &bull; Staff SRE
              </button>
              <button
                type="button"
                className="persona-option"
                onClick={() => handleSelectRole('Priya Patel', 'Tech Lead', 'PP')}
              >
                <strong>Priya Patel</strong> &bull; Tech Lead
              </button>
              <button
                type="button"
                className="persona-option"
                onClick={() => handleSelectRole('Marcus Vance', 'Principal Architect', 'MV')}
              >
                <strong>Marcus Vance</strong> &bull; Principal Architect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Meta AI SRE Architectural Risk Badge */}
      <div className="huddle-sre-status">
        {aiRaisedHand ? (
          <button
            type="button"
            className="btn-sre-callout pulse-alert"
            onClick={onYieldFloor}
            title="Meta AI SRE has raised a Sev-1 architectural risk"
          >
            <span className="ai-icon-shield">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
            </span>
            <span>Meta AI SRE Raised Hand ({hazards.length})</span>
          </button>
        ) : (
          <div className="sre-idle-pill">
            <span className="sre-scan-dot" />
            <span>AI SRE Sentinel: Monitoring Active</span>
          </div>
        )}
      </div>

      {/* Audio & Room Management Actions */}
      <div className="huddle-actions">
        <button
          type="button"
          className={`btn-huddle-action ${isMuted ? 'muted' : ''}`}
          onClick={() => setIsMuted((prev) => !prev)}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? 'Muted' : 'Mute'}
        </button>

        <button
          type="button"
          className="btn-huddle-action"
          onClick={handleShare}
          title="Copy room code and invite link"
        >
          {copied ? 'Link Copied!' : 'Share Room'}
        </button>

        <button
          type="button"
          className="btn-huddle-action danger"
          onClick={onToggleConnect}
          title="Disconnect from review room"
        >
          Leave Call
        </button>
      </div>
    </div>
  );
}
