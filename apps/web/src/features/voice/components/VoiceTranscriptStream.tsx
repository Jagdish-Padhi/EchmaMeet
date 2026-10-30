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
        border: '1px solid #cbd5e1',
        borderRadius: 6,
        padding: 12,
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Spoken Transcript:</span>
        <div style={{ display: 'flex', gap: 6 }}>
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
          fontFamily: 'monospace',
          color: '#0f172a',
          lineHeight: 1.5,
        }}
      >
        {finalTranscript ? (
          <span>{finalTranscript}</span>
        ) : partialTranscript ? (
          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{partialTranscript}</span>
        ) : (
          <span style={{ color: '#94a3b8' }}>
            Press hold-to-talk or click a test phrase below to speak...
          </span>
        )}
      </div>
    </div>
  );
};
