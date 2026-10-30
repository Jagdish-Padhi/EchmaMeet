import React from 'react';
import { Button } from '../../../components/ui/Button';

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
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
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          border: isRecording ? '3px solid #dc2626' : '3px solid #b45309',
          background: isRecording ? '#fee2e2' : '#fef3c7',
          color: isRecording ? '#dc2626' : '#92400e',
          fontSize: 13,
          fontWeight: 700,
          cursor: isProcessing ? 'not-allowed' : 'pointer',
          outline: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease-in-out',
        }}
      >
        <span>{isRecording ? 'RELEASE' : 'HOLD'}</span>
        <span style={{ fontSize: 10, fontWeight: 500 }}>{isRecording ? 'TO SEND' : 'TO TALK'}</span>
      </button>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          variant={isRecording ? 'danger' : 'ghost'}
          size="sm"
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={isProcessing}
        >
          {isRecording ? 'Stop Recording' : 'Click to Toggle Recording'}
        </Button>
      </div>

      <span style={{ fontSize: 11, color: '#64748b' }}>
        Single-speaker push-to-talk. Audio streams directly to backend with zero persistent storage.
      </span>
    </div>
  );
};
