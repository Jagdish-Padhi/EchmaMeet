import { generateRoomCode } from './room-code';
import { useState, useEffect, type SyntheticEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { useMicrophonePreflight } from './useMicrophonePreflight';
import { MicrophonePreflightBanner } from './components/MicrophonePreflightBanner';
import { TranscriptionConsentField } from './components/TranscriptionConsentField';

export interface CreateMeetingModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onCreate: (
    roomCode: string,
    topic: string,
    role: string,
    allowTranscription?: boolean,
  ) => void;
}

export function CreateMeetingModal({ isOpen, onClose, onCreate }: CreateMeetingModalProps) {
  const [roomCode, setRoomCode] = useState(() => generateRoomCode());
  const [topic, setTopic] = useState('Architecture Review');
  const [role, setRole] = useState<'Staff SRE' | 'Tech Lead' | 'Principal Architect'>('Staff SRE');

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

  const handleGenerateCode = () => {
    setRoomCode(generateRoomCode());
  };

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    onCreate(roomCode.trim(), topic.trim(), role, allowTranscription);
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
        aria-labelledby="create-meeting-title"
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
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 id="create-meeting-title" className="meeting-dialog-title">
              Create Meeting
            </h2>
            <p className="meeting-dialog-subtitle">
              Start a live architecture review room for your team with automated risk detection.
            </p>
          </div>
          <button type="button" className="btn-close-drawer" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="meeting-dialog-form">
          <MicrophonePreflightBanner preflight={micPreflight} />
          <div className="meeting-form-field">
            <label htmlFor="create-room-code" className="meeting-form-label">
              Room Code
            </label>
            <div className="meeting-input-with-action">
              <input
                id="create-room-code"
                type="text"
                className="meeting-text-input"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn-meeting-inline"
                onClick={handleGenerateCode}
                title="Generate fresh code"
              >
                Regenerate
              </button>
            </div>
          </div>

          <div className="meeting-form-field">
            <label htmlFor="create-topic" className="meeting-form-label">
              Meeting Topic
            </label>
            <input
              id="create-topic"
              type="text"
              className="meeting-text-input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Checkout Service Architecture"
              required
            />
          </div>

          <div className="meeting-form-field">
            <label htmlFor="create-role" className="meeting-form-label">
              Role
            </label>
            <select
              id="create-role"
              className="meeting-select-input"
              value={role}
              onChange={(e) =>
                setRole(e.target.value as 'Staff SRE' | 'Tech Lead' | 'Principal Architect')
              }
            >
              <option value="Staff SRE">Staff SRE</option>
              <option value="Tech Lead">Tech Lead</option>
              <option value="Principal Architect">Principal Architect</option>
            </select>
          </div>

          <TranscriptionConsentField
            id="create-transcription-consent"
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
              disabled={micPreflight.status === 'failed' || micPreflight.status === 'denied'}
            >
              Create Room
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
