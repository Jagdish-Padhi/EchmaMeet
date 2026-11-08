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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(15,23,42,0.75)',
      }}
    >
      <label
        style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#94a3b8' }}
      >
        <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Spoken language (Gnani Prisma)
        </span>
        <select
          value={language}
          onChange={(e) => onLanguageChange(e.target.value)}
          disabled={live}
          aria-label="Spoken language"
          style={{
            padding: '6px 8px',
            borderRadius: 6,
            background: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #334155',
          }}
        >
          {VOICE_LANGUAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label
        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#cbd5e1' }}
      >
        <input type="checkbox" checked={speakReplies} onChange={onToggleSpeakReplies} />
        Speak replies in my language (Gnani Timbre)
        {isSpeaking && <span style={{ color: '#38bdf8' }}> • speaking</span>}
      </label>

      <button
        type="button"
        onClick={live ? onStopLive : onStartLive}
        aria-pressed={live}
        style={{
          padding: '8px 10px',
          borderRadius: 6,
          fontWeight: 700,
          cursor: 'pointer',
          border: `1px solid ${live ? '#f43f5e' : '#38bdf8'}`,
          background: live ? 'rgba(225,29,72,0.15)' : 'rgba(56,189,248,0.12)',
          color: live ? '#fda4af' : '#7dd3fc',
        }}
      >
        {LIVE_LABEL[liveStatus]}
      </button>
    </div>
  );
};
