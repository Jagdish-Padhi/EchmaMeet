import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface AlreadyInCallModalProps {
  readonly isOpen: boolean;
  readonly roomCode: string;
  readonly attemptedAction: 'create' | 'join';
  readonly onClose: () => void;
  readonly onLeaveAndProceed?: (() => void) | undefined;
}

export function AlreadyInCallModal({
  isOpen,
  roomCode,
  attemptedAction,
  onClose,
  onLeaveAndProceed,
}: AlreadyInCallModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actionText = attemptedAction === 'create' ? 'create a new' : 'join another';

  const modalContent = (
    <div
      className="modal-backdrop already-in-call-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(5, 7, 12, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="meeting-leave-confirm-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="already-in-call-title"
        style={{ margin: 'auto' }}
      >
        <div className="already-in-call-icon-badge">
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        <h3 id="already-in-call-title" className="leave-modal-title">
          You are already in a meeting
        </h3>

        <p className="leave-modal-text">
          You are currently in meeting <strong className="cell-mono">{roomCode}</strong>. Please
          leave your active session before {actionText} review room.
        </p>

        <div className="leave-modal-actions">
          <button type="button" className="btn-leave-cancel" onClick={onClose} autoFocus>
            Stay in Meeting
          </button>
          {onLeaveAndProceed && (
            <button type="button" className="btn-leave-danger" onClick={onLeaveAndProceed}>
              Leave &amp; {attemptedAction === 'create' ? 'Create' : 'Join'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // When rendered on client, portal to document.body so topbar CSS transforms/filters cannot offset centering
  if (mounted && typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
