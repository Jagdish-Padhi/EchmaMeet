import React from 'react';
import { VOICE_LANGUAGE_OPTIONS, type LiveStatus } from '../types';

export interface VoiceControlsProps {
  readonly language: string;
  readonly onLanguageChange: (language: string) => void;
  readonly speakReplies: boolean;
  readonly onToggleSpeakReplies: () => void;
  readonly liveStatus: LiveStatus;
  readonly onStartLive: () => void;
  readonly onStopLive: () => void;
  readonly isSpeaking: boolean;
}

const LIVE_LABEL: Record<LiveStatus, string> = {
  off: 'Start hands-free',
  connecting: 'Connecting to Gnani…',
  listening: 'Listening — tap to stop',
  unavailable: 'Retry hands-free',
};

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  language,
  onLanguageChange,
  speakReplies,
  onToggleSpeakReplies,
  liveStatus,
  onStartLive,
  onStopLive,
  isSpeaking,
}) => {
  const live = liveStatus === 'listening' || liveStatus === 'connecting';
  return (
    <div className="voice-studio-card">
      <label className="voice-label-group">
        <span className="voice-label-title">
          Spoken language (Gnani Prisma STT)
        </span>
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          disabled={live}
          aria-label="Spoken language"
          className="voice-select input-select"
        >
          {VOICE_LANGUAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="voice-checkbox-row">
        <input type="checkbox" checked={speakReplies} onChange={onToggleSpeakReplies} />
        <span>Spoken replies via Gnani Timbre (Lakshmi)</span>
        {isSpeaking && <span style={{ color: 'var(--color-accent)' }}> • Speaking</span>}
      </label>

      <button
        type="button"
        onClick={live ? onStopLive : onStartLive}
        aria-pressed={live}
        className={`voice-live-btn ${live ? 'live' : 'off'}`}
      >
        {LIVE_LABEL[liveStatus]}
      </button>
    </div>
  );
};
