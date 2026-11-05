import { useState, useEffect, type SyntheticEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { useMicrophonePreflight } from './useMicrophonePreflight';
import { MicrophonePreflightBanner } from './components/MicrophonePreflightBanner';
import { TranscriptionConsentField } from './components/TranscriptionConsentField';

export interface JoinMeetingModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onJoinWithCode: (roomCode: string, allowTranscription?: boolean) => void;
  readonly onJoinSoloAi: (allowTranscription?: boolean) => void;
}

export function JoinMeetingModal({
  isOpen,
  onClose,
  onJoinWithCode,
  onJoinSoloAi,
}: JoinMeetingModalProps) {
  const [roomCode, setRoomCode] = useState('');
  const [activeTab, setActiveTab] = useState<'code' | 'solo'>('code');
  const [allowTranscription, setAllowTranscription] = useState(false);

  const micPreflight = useMicrophonePreflight();

  useEffect(() => {
    if (isOpen) {
      void micPreflight.startMicTest();
    } else {
      micPreflight.stopMicTest();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmitCode = (e: SyntheticEvent) => {
    e.preventDefault();
    const cleanCode = roomCode.trim();
    if (!cleanCode) return;
    onJoinWithCode(cleanCode.startsWith('#') ? cleanCode : `#${cleanCode}`, allowTranscription);
    micPreflight.stopMicTest();
    onClose();
  };

  const handleStartSolo = () => {
    onJoinSoloAi(allowTranscription);
    micPreflight.stopMicTest();
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
              Join Meeting
            </h2>
            <p className="meeting-dialog-subtitle">
              Join an architecture review room with your team or review your diagram with AI.
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
            <span>Team Room</span>
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
            <span>Solo with AI</span>
          </button>
        </div>

        {/* Tab 1: Enter Code */}
        {activeTab === 'code' && (
          <form onSubmit={handleSubmitCode} className="meeting-dialog-form">
            <MicrophonePreflightBanner preflight={micPreflight} />
            <div className="meeting-form-field">
              <label htmlFor="join-room-code" className="meeting-form-label">
                Room Code
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
            </div>

            <TranscriptionConsentField
              id="join-transcription-consent"
              checked={allowTranscription}
              onChange={setAllowTranscription}
            />

            <div className="meeting-dialog-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  micPreflight.stopMicTest();
                  onClose();
                }}
                type="button"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={
                  !roomCode.trim() ||
                  micPreflight.status === 'failed' ||
                  micPreflight.status === 'denied'
                }
              >
                Join Room
              </Button>
            </div>
          </form>
        )}

        {/* Tab 2: Solo with AI */}
        {activeTab === 'solo' && (
          <div className="meeting-solo-panel">
            <MicrophonePreflightBanner preflight={micPreflight} />
            <div className="solo-ai-card">
              <div className="solo-ai-header">
                <div className="solo-ai-emblem">
                  <span className="solo-ai-dot" />
                </div>
                <div>
                  <div className="solo-ai-title">Solo Architecture Review</div>
                  <div className="solo-ai-desc">
                    Review your architecture 1-on-1 with the AI. It flags bottlenecks, circular
                    loops, and single points of failure in real time.
                  </div>
                </div>
              </div>
            </div>

            <TranscriptionConsentField
              id="solo-transcription-consent"
              checked={allowTranscription}
              onChange={setAllowTranscription}
            />

            <div className="meeting-dialog-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  micPreflight.stopMicTest();
                  onClose();
                }}
                type="button"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleStartSolo}
                type="button"
                disabled={micPreflight.status === 'failed' || micPreflight.status === 'denied'}
              >
                Start Solo Review
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
