import { useState, type SyntheticEvent } from 'react';

export interface JoinMeetingModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onJoinWithCode: (roomCode: string) => void;
  readonly onJoinSoloAi: () => void;
}

export function JoinMeetingModal({
  isOpen,
  onClose,
  onJoinWithCode,
  onJoinSoloAi,
}: JoinMeetingModalProps) {
  const [roomCode, setRoomCode] = useState('');
  const [activeTab, setActiveTab] = useState<'code' | 'solo'>('code');

  if (!isOpen) return null;

  const handleSubmitCode = (e: SyntheticEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim();
    if (!cleanCode) return;
    onJoinWithCode(cleanCode.startsWith('#') ? cleanCode : `#${cleanCode}`);
    onClose();
  };

  const handleStartSolo = () => {
    onJoinSoloAi();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="meeting-dialog-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-meeting-title"
      >
        <div className="meeting-dialog-header">
          <div className="meeting-dialog-icon">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div>
            <h2 id="join-meeting-title" className="meeting-dialog-title">
              Join Architecture Review Session
            </h2>
            <p className="meeting-dialog-subtitle">
              Connect to an existing team room or launch a private solo AI review session.
            </p>
          </div>
          <button type="button" className="btn-close-drawer" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {/* Tab Selection */}
        <div className="meeting-tabs-row" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'code'}
            className={`meeting-tab-btn ${activeTab === 'code' ? 'active' : ''}`}
            onClick={() => setActiveTab('code')}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span>Enter Meeting Code</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'solo'}
            className={`meeting-tab-btn ${activeTab === 'solo' ? 'active' : ''}`}
            onClick={() => setActiveTab('solo')}
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
            <span>Solo with AI SRE</span>
          </button>
        </div>

        {/* Tab 1: Enter Code */}
        {activeTab === 'code' && (
          <form onSubmit={handleSubmitCode} className="meeting-dialog-form">
            <div className="meeting-form-field">
              <label htmlFor="join-room-code" className="meeting-form-label">
                Meeting Code or Invite Link
              </label>
              <input
                id="join-room-code"
                type="text"
                className="meeting-text-input"
                placeholder="e.g. #rfc-checkout-v2"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                autoFocus
                required
              />
              <span className="meeting-form-hint">
                Paste the room code or full URL shared by your peer reviewer.
              </span>
            </div>

            <div className="meeting-dialog-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={!roomCode.trim()}>
                Join Review Room
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Solo with AI */}
        {activeTab === 'solo' && (
          <div className="meeting-solo-panel">
            <div className="solo-ai-card">
              <div className="solo-ai-header">
                <div className="solo-ai-emblem">
                  <span className="solo-ai-dot" />
                </div>
                <div>
                  <div className="solo-ai-title">Autonomous Meta AI SRE Reviewer</div>
                  <div className="solo-ai-desc">
                    Continuous real-time invariant monitoring &amp; hazard detection
                  </div>
                </div>
              </div>
              <ul className="solo-ai-perks">
                <li>Instant 1-on-1 private architecture session without waiting for peers</li>
                <li>Continuous queue saturation, retry storm, and cascade failure detection</li>
                <li>
                  Live sandbox proof execution &amp; automated resilience policy patch proposal
                </li>
              </ul>
            </div>

            <div className="meeting-dialog-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleStartSolo}>
                Start Solo AI Review
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
