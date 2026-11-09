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
    <div className="voice-transcript-card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span className="voice-label-title">
          Live Spoken Transcript
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

      <div className="voice-transcript-box">
        {finalTranscript ? (
          <span style={{ color: 'var(--color-accent)' }}>{finalTranscript}</span>
        ) : partialTranscript ? (
          <span style={{ color: 'var(--color-text-dim)', fontStyle: 'italic' }}>{partialTranscript}</span>
        ) : (
          <span style={{ color: 'var(--color-text-muted)' }}>
            Hold to talk or select a suggested command below...
          </span>
        )}
      </div>
    </div>
  );
};
