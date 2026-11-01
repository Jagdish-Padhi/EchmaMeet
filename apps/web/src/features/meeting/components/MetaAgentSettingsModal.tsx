import { useState } from 'react';
import { Button } from '../../../components/ui/Button';

export interface MetaAgentSettingsModalProps {
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

export function MetaAgentSettingsModal({
  isOpen,
  onClose,
  tokenUsage,
}: MetaAgentSettingsModalProps) {
  const [provider, setProvider] = useState<'groq' | 'meta'>('groq');

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: '520px', padding: '24px' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Echma SRE Agent
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Real-time architecture analysis powered by Meta Llama 3
            </p>
          </div>
          <button type="button" className="btn-close-drawer" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#93c5fd' }}>
                Pipeline Status
              </div>
              <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '2px' }}>
                Active &bull; Llama 3.3 70B
              </div>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '9999px',
                background: '#10b981',
                color: '#ffffff',
              }}
            >
              Ready
            </span>
          </div>

          <div>
            <label
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#cbd5e1',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              Inference Provider
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setProvider('groq')}
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: `1px solid ${provider === 'groq' ? '#3b82f6' : '#334155'}`,
                  background: provider === 'groq' ? 'rgba(59, 130, 246, 0.15)' : '#1e293b',
                  color: provider === 'groq' ? '#60a5fa' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>Groq Llama 3.3</div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>Free tier testing</div>
              </button>

              <button
                type="button"
                onClick={() => setProvider('meta')}
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: `1px solid ${provider === 'meta' ? '#3b82f6' : '#334155'}`,
                  background: provider === 'meta' ? 'rgba(59, 130, 246, 0.15)' : '#1e293b',
                  color: provider === 'meta' ? '#60a5fa' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>Meta Partner API</div>
                <div style={{ fontSize: '10px', opacity: 0.8 }}>$150 hackathon credits</div>
              </button>
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              borderRadius: '6px',
              background: '#0f172a',
              border: '1px solid #1e293b',
              fontSize: '12px',
              color: '#94a3b8',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span>Total Tokens Consumed:</span>
              <strong style={{ color: '#f8fafc' }}>
                {tokenUsage?.totalTokens ? tokenUsage.totalTokens.toLocaleString() : '0'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Protection Mode:</span>
              <span style={{ color: '#10b981' }}>2.5s Debounce &bull; Cache Active</span>
            </div>
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
