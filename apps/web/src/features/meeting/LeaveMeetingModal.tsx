import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface LeaveMeetingModalProps {
  readonly isOpen: boolean;
  readonly roomCode: string;
  readonly onConfirmLeave: () => void;
  readonly onCancel: () => void;
}

export function LeaveMeetingModal({
  isOpen,
  roomCode,
  onConfirmLeave,
  onCancel,
}: LeaveMeetingModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirmLeave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirmLeave]);

  if (!isOpen) return null;

  const modalElement = (
    <div className="modal-backdrop" onClick={onCancel} style={{ zIndex: 10000 }}>
      <div
        className="meeting-leave-confirm-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-modal-title"
      >
        <div className="leave-modal-icon-badge">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.39.39.39 1.02 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
          </svg>
        </div>

        <h3 id="leave-modal-title" className="leave-modal-title">
          Leave Meeting?
        </h3>

        <p className="leave-modal-text">
          Are you sure you want to leave meeting <strong className="cell-mono">{roomCode}</strong>?
          You will be disconnected from video, audio, and the shared board.
        </p>

        <div className="leave-modal-actions">
          <button type="button" className="btn-leave-cancel" onClick={onCancel} autoFocus>
            Stay in Meeting
          </button>
          <button type="button" className="btn-leave-danger" onClick={onConfirmLeave}>
            Leave Meeting
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalElement, document.body);
  }

  return modalElement;
}
