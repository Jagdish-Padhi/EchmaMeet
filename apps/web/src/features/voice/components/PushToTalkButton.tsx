import React from 'react';

export interface PushToTalkButtonProps {
  readonly isRecording: boolean;
  readonly isProcessing: boolean;
  readonly onStartRecording: () => void;
  readonly onStopRecording: () => void;
}

export const PushToTalkButton: React.FC<PushToTalkButtonProps> = ({
  isRecording,
  isProcessing,
  onStartRecording,
  onStopRecording,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'relative' }}>
        {/* Pulsing ring during recording */}
        {isRecording && (
          <div
            style={{
              position: 'absolute',
              inset: -8,
              borderRadius: '50%',
              border: '2px solid rgba(244, 63, 94, 0.6)',
              animation: 'pulseGlow 1s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />
        )}

        <button
          type="button"
          onMouseDown={onStartRecording}
          onMouseUp={onStopRecording}
          onMouseLeave={() => {
            if (isRecording) onStopRecording();
          }}
          onTouchStart={onStartRecording}
          onTouchEnd={onStopRecording}
          disabled={isProcessing}
          aria-label={isRecording ? 'Release to send voice command' : 'Hold to talk'}
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            border: isRecording ? '2px solid #f43f5e' : '2px solid var(--color-border)',
            background: isRecording
              ? 'linear-gradient(135deg, rgba(225, 29, 72, 0.25), rgba(159, 18, 57, 0.35))'
              : 'var(--color-surface)',
            color: isRecording ? '#f43f5e' : 'var(--color-accent)',
            boxShadow: isRecording
              ? '0 0 25px rgba(244, 63, 94, 0.5)'
              : '0 4px 12px rgba(0, 0, 0, 0.1)',
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: '0.04em',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            outline: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* Microphone SVG icon */}
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
          <span>{isRecording ? 'RELEASE' : 'HOLD'}</span>
          <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.8 }}>
            {isRecording ? 'TO SEND' : 'TO TALK'}
          </span>
        </button>
      </div>
    </div>
  );
};
