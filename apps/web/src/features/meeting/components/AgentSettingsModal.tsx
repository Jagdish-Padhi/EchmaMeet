import { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { meetingAudio } from '../services/audioAlert';

export interface AgentSettingsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly tokenUsage?:
    | {
        promptTokens?: number | undefined;
        completionTokens?: number | undefined;
        totalTokens?: number | undefined;
      }
    | null
    | undefined;
}

const ROWS: readonly { readonly label: string; readonly value: string; readonly tone: string }[] = [
  {
    label: 'Hearing',
    value: 'Gnani Prisma v3 • 10 Indian languages + code-mixed',
    tone: '#38bdf8',
  },
  {
    label: 'Speaking',
    value: 'Gnani Timbre • Hindi, English, Tamil, Telugu and more',
    tone: '#38bdf8',
  },
  {
    label: 'Hazard analysis',
    value: 'Deterministic rule engine (no LLM required)',
    tone: '#10b981',
  },
  {
    label: 'Repair diagnosis',
    value: 'Trained random-forest model + rule engine',
    tone: '#10b981',
  },
  {
    label: 'Optional reasoning',
    value: 'Gnani Evon (open weights) via EVON_BASE_URL',
    tone: '#a78bfa',
  },
];

export function AgentSettingsModal({ isOpen, onClose, tokenUsage }: AgentSettingsModalProps) {
  const [speed, setSpeed] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('echma_speech_speed');
      if (saved) return parseFloat(saved);
    }
    return meetingAudio.getSpeechSpeed();
  });

  const [voice, setVoice] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('echma_speech_voice');
      if (saved) return saved;
    }
    return meetingAudio.getVoiceOverride() || 'Lakshmi';
  });

  useEffect(() => {
    meetingAudio.setSpeechSpeed(speed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('echma_speech_speed', String(speed));
    }
  }, [speed]);

  useEffect(() => {
    meetingAudio.setVoiceOverride(voice);
    if (typeof window !== 'undefined') {
      localStorage.setItem('echma_speech_voice', voice);
    }
  }, [voice]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: '520px', padding: '24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--color-text)' }}>Echma SRE Agent</h3>
        <p style={{ margin: '6px 0 16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Voice-first architecture review. Every claim is backed by a rule or a measured run.
        </p>

        {/* Voice Delivery & Cadence Tuning */}
        <div
          style={{
            padding: '12px',
            borderRadius: '6px',
            background: 'var(--color-bg-alt)',
            border: '1px solid var(--color-border)',
            marginBottom: '12px',
            fontSize: '12px',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>
            Voice Cadence & Warmth
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', marginBottom: '4px', fontSize: '11px' }}>
                Speaking Pace
              </label>
              <select
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  background: 'var(--color-surface-elevated)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  fontSize: '12px',
                }}
              >
                <option value={1.00}>1.00x — Pure Native Lakshmi (Recommended)</option>
                <option value={0.95}>0.95x — Slightly Relaxed</option>
                <option value={1.05}>1.05x — Crisp &amp; Prompt</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', color: 'var(--color-text-muted)', marginBottom: '4px', fontSize: '11px' }}>
                Female Persona
              </label>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  background: 'var(--color-surface-elevated)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  fontSize: '12px',
                }}
              >
                <option value="Lakshmi">Lakshmi (Pure Natural Indian English — Recommended)</option>
                <option value="Kaveri">Kaveri (Clear &amp; Professional Tone)</option>
                <option value="Saanvi">Saanvi (Engaging Technical Persona)</option>
                <option value="Trisha">Trisha (Gentle Cadence)</option>
                <option value="Aarohi">Aarohi (Polished Advisory Persona)</option>
                <option value="Nalini">Nalini (Articulate Hindi &amp; English)</option>
                <option value="Riyaa">Riyaa (Balanced Persona — Timbre v3)</option>
                <option value="Tarika">Tarika (Focused SRE Reviewer — Timbre v3)</option>
                <option value="Shivani">Shivani (Direct Infrastructure Persona — Timbre v3)</option>
                <option value="Chetana">Chetana (Crisp Technical Lead — Timbre v3)</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {ROWS.map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'var(--color-bg-alt)',
                border: '1px solid var(--color-border)',
                fontSize: '12px',
              }}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>{row.label}</span>
              <span style={{ color: row.tone, textAlign: 'right' }}>{row.value}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: '12px',
            borderRadius: '6px',
            background: 'var(--color-bg-alt)',
            border: '1px solid var(--color-border)',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span>Total Tokens Consumed:</span>
            <strong style={{ color: 'var(--color-text)' }}>
              {tokenUsage?.totalTokens ? tokenUsage.totalTokens.toLocaleString() : '0'}
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Protection Mode:</span>
            <span style={{ color: 'var(--color-success)' }}>Smart VAD &bull; On-Demand CC &bull; Mute Guard</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
