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
    {
      id: 'user-2',
      name: 'Elena Rostova',
      role: 'Principal Architect',
      avatar: 'ER',
      isSpeaking: true,
      isMuted: false,
    },
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
          title="Join live Google Meet / Figma-style Architecture Review Huddle"
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
          const isAi = p.role === 'Meta AI SRE';
          return (
            <div
              key={p.id}
              className={`huddle-avatar-pill ${p.isSpeaking ? 'speaking-waveform' : ''} ${
                isAi ? 'huddle-avatar-ai' : ''
              }`}
              title={`${p.name} (${p.role}) ${p.isMuted ? '• Muted' : ''}`}
            >
              <span className="huddle-avatar-initials">{p.avatar}</span>
              {p.isMuted && <span className="huddle-muted-dot" />}
            </div>
          );
        })}
      </div>

      {/* Switch Persona Trigger */}
      <div className="huddle-role-dropdown-container">
        <button
          type="button"
          className="huddle-role-btn"
          onClick={() => setShowPersonaMenu((open) => !open)}
          title="Switch engineering role"
        >
          <span>{currentUser.role}</span>
          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
            <path d="M7 10l5 5 5-5z" />
          </svg>
        </button>

        {showPersonaMenu && (
          <div className="huddle-persona-menu">
            <button
              type="button"
              className="huddle-persona-item"
              onClick={() => handleSelectRole('Alex Chen', 'Staff SRE', 'AC')}
            >
              <span className="persona-avatar">AC</span>
              <div className="persona-meta">
                <span className="persona-name">Alex Chen</span>
                <span className="persona-title">Staff SRE</span>
              </div>
            </button>
            <button
              type="button"
              className="huddle-persona-item"
              onClick={() => handleSelectRole('Marcus Vance', 'Tech Lead', 'MV')}
            >
              <span className="persona-avatar">MV</span>
              <div className="persona-meta">
                <span className="persona-name">Marcus Vance</span>
                <span className="persona-title">Tech Lead</span>
              </div>
            </button>
            <button
              type="button"
              className="huddle-persona-item"
              onClick={() => handleSelectRole('Elena Rostova', 'Principal Architect', 'ER')}
            >
              <span className="persona-avatar">ER</span>
              <div className="persona-meta">
                <span className="persona-name">Elena Rostova</span>
                <span className="persona-title">Principal Architect</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Audio Mute/Unmute Huddle Mic */}
      <button
        type="button"
        className={`huddle-control-btn ${isMuted ? 'btn-mic-muted' : 'btn-mic-active'}`}
        onClick={() => setIsMuted((m) => !m)}
        title={isMuted ? 'Unmute microphone (Ctrl+Shift+M)' : 'Mute microphone'}
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

      {/* Meta AI SRE Floor Interruption Button */}
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

      {/* Copy Room Link */}
      <button
        type="button"
        className="btn-share-room"
        onClick={handleShare}
        title="Copy secure Review Huddle Link"
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

      {/* Leave Huddle */}
      <button
        type="button"
        className="btn-leave-room"
        onClick={onToggleConnect}
        title="Leave Review Huddle"
      >
        Leave
      </button>
    </div>
  );
}
