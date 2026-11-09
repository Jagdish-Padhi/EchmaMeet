import { useEffect, useState } from 'react';
import type { RunEvent, RunId } from '@chaosboard/contracts';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';

export interface ReplayModalProps {
  readonly runId: RunId;
  readonly events: readonly RunEvent[];
  readonly onClose: () => void;
}

function getEventBadgeClass(type: string): string {
  if (type.includes('started') || type.includes('ready')) return 'replay-badge-info';
  if (type.includes('fault')) return 'replay-badge-warn';
  if (type.includes('finished') || type.includes('accepted')) return 'replay-badge-success';
  if (type.includes('invalid') || type.includes('failed') || type.includes('rejected'))
    return 'replay-badge-danger';
  if (type.includes('repair') || type.includes('patch')) return 'replay-badge-optimizer';
  return 'replay-badge-default';
}

function formatEventType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ReplayModal({ events, onClose }: ReplayModalProps) {
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showJson, setShowJson] = useState(false);

  const totalEvents = events.length;
  const currentEvent = events[step];

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev >= totalEvents - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 750);
    return () => clearInterval(timer);
  }, [isPlaying, totalEvents]);

  if (totalEvents === 0 || !currentEvent) {
    return (
      <Modal title="Execution Event Replay" isOpen={true} onClose={onClose} size="md">
        <p className="replay-empty-message">No events recorded for this simulation.</p>
      </Modal>
    );
  }

  const payloadEntries = currentEvent.payload
    ? Object.entries(currentEvent.payload).filter(([k]) => k !== 'runId')
    : [];

  return (
    <Modal
      title="Execution Event Replay"
      isOpen={true}
      onClose={onClose}
      size="lg"
      className="replay-clean-modal"
    >
      <div className="replay-clean-wrapper">
        {/* Compact Player Control Bar */}
        <div className="replay-player-bar">
          <div className="player-controls">
            <Button
              variant="secondary"
              size="sm"
              disabled={step <= 0}
              onClick={() => {
                setIsPlaying(false);
                setStep((s) => Math.max(0, s - 1));
              }}
              title="Previous Event"
            >
              ◀
            </Button>
            <Button
              variant={isPlaying ? 'danger' : 'primary'}
              size="sm"
              onClick={() => setIsPlaying((p) => !p)}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={step >= totalEvents - 1}
              onClick={() => {
                setIsPlaying(false);
                setStep((s) => Math.min(totalEvents - 1, s + 1));
              }}
              title="Next Event"
            >
              ▶
            </Button>
          </div>

          {/* Stepper scrubber */}
          <div className="player-scrubber">
            <input
              type="range"
              min={0}
              max={totalEvents - 1}
              value={step}
              onChange={(e) => {
                setIsPlaying(false);
                setStep(Number(e.target.value));
              }}
              className="player-slider"
              aria-label="Replay Timeline"
            />
            <div className="player-meta">
              <span className="player-step-text">
                Event <strong>{String(step + 1)}</strong> of <strong>{String(totalEvents)}</strong>
              </span>
              <span className="player-timestamp cell-mono">
                +{((currentEvent.timestampMs ?? 0) / 1000).toFixed(2)}s
              </span>
            </div>
          </div>
        </div>

        {/* Horizontal Event Step Selector */}
        <div className="replay-steps-ribbon" role="tablist">
          {events.map((ev, idx) => (
            <button
              key={`${String(ev.sequence)}-${ev.type}`}
              type="button"
              className={`ribbon-step-btn ${idx === step ? 'active' : ''}`}
              onClick={() => {
                setIsPlaying(false);
                setStep(idx);
              }}
              title={`Step ${String(idx + 1)}: ${ev.type}`}
            >
              #{String(idx + 1)}
            </button>
          ))}
        </div>

        {/* Active Event Card */}
        <div className="replay-card">
          <div className="replay-card-header">
            <span className={`replay-badge ${getEventBadgeClass(currentEvent.type)}`}>
              {formatEventType(currentEvent.type)}
            </span>
            <span className="replay-time-tag cell-mono">
              T + {((currentEvent.timestampMs ?? 0) / 1000).toFixed(3)}s
            </span>
          </div>

          {/* Structured Parameters */}
          {payloadEntries.length > 0 ? (
            <div className="replay-params-table-wrap">
              <table className="replay-params-table">
                <tbody>
                  {payloadEntries.map(([key, val]) => (
                    <tr key={key}>
                      <td className="param-key-cell">{key}</td>
                      <td className="param-val-cell cell-mono">
                        {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="replay-no-params">No dynamic parameters attached to this lifecycle transition.</div>
          )}

          {/* JSON Toggle */}
          <div className="replay-json-toggle-wrap">
            <button
              type="button"
              className="replay-json-toggle"
              onClick={() => setShowJson((prev) => !prev)}
            >
              {showJson ? '▾ Hide Technical JSON' : '▸ View Raw Event JSON'}
            </button>
            {showJson && (
              <pre className="replay-json-block cell-mono">
                {JSON.stringify(currentEvent.payload, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
