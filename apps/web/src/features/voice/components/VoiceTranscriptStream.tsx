import React from 'react';
import type { VoiceTimings } from '@chaosboard/contracts';
import { Badge } from '../../../components/ui/Badge';

export interface VoiceTranscriptStreamProps {
  readonly partialTranscript: string;
  readonly finalTranscript: string;
  readonly isRecording: boolean;
  readonly isProcessing: boolean;
  readonly timings: VoiceTimings | null;
}

export const VoiceTranscriptStream: React.FC<VoiceTranscriptStreamProps> = ({
  partialTranscript,
  finalTranscript,
  isRecording,
  isProcessing,
  timings,
}) => {
  return (
    <div
      style={{
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        padding: 14,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#94a3b8',
          }}
        >
          Spoken Transcript:
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {isRecording && <Badge variant="danger">Recording Live</Badge>}
          {isProcessing && <Badge variant="accent">Processing Speech</Badge>}
          {timings && (
            <>
              <Badge variant="neutral">Capture: {String(timings.captureMs)}ms</Badge>
              <Badge variant="neutral">STT: {String(timings.transcriptMs)}ms</Badge>
              <Badge variant="neutral">Parse: {String(timings.parseMs)}ms</Badge>
            </>
          )}
        </div>
      </div>

      <div
        style={{
          minHeight: 48,
          fontSize: 14,
          fontFamily: 'var(--font-mono)',
          color: '#f8fafc',
          lineHeight: 1.6,
          background: 'rgba(2, 6, 23, 0.6)',
          padding: '10px 12px',
          borderRadius: 6,
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {finalTranscript ? (
          <span style={{ color: '#38bdf8' }}>{finalTranscript}</span>
        ) : partialTranscript ? (
          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{partialTranscript}</span>
        ) : (
          <span style={{ color: '#64748b' }}>
            Press hold-to-talk or click a test phrase below to speak...
          </span>
        )}
      </div>
    </div>
  );
};
