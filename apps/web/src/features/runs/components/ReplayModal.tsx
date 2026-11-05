import { useState } from 'react';
import type { RunEvent, RunId } from '@chaosboard/contracts';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';

export interface ReplayModalProps {
  readonly runId: RunId;
  readonly events: readonly RunEvent[];
  readonly onClose: () => void;
}

export function ReplayModal({ runId, events, onClose }: ReplayModalProps) {
  const [step, setStep] = useState(0);
  const [showRawDetails, setShowRawDetails] = useState(false);

  const currentEvent = events[step];

  const renderPayloadSummary = (payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return <div className="replay-empty-val">{String(payload ?? 'None')}</div>;
    }

    const entries = Object.entries(payload as Record<string, unknown>);
    if (entries.length === 0) {
      return <div className="replay-empty-val">No payload parameters attached.</div>;
    }

    return (
      <div className="replay-fields-grid">
        {entries.map(([key, val]) => (
          <div key={key} className="replay-field-row">
            <span className="replay-field-key">{key}:</span>
            <span className="replay-field-value cell-mono">
              {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Modal
      title={`Event Replay: ${runId}`}
      isOpen={true}
      onClose={onClose}
      actions={
        <div className="replay-controls">
          <Button
            variant="secondary"
            size="sm"
            disabled={step <= 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Previous
          </Button>
          <span className="replay-step-counter">
            Step {String(step + 1)} of {String(events.length)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={step >= events.length - 1}
            onClick={() => setStep((s) => Math.min(events.length - 1, s + 1))}
          >
            Next
          </Button>
        </div>
      }
    >
      <div className="replay-content">
        {currentEvent ? (
          <div className="replay-event-card">
            <div className="replay-event-header">
              <span className="event-seq cell-mono">Step #{String(currentEvent.sequence)}</span>
              <span className="event-type">{currentEvent.type}</span>
              <span className="event-time cell-mono">+{String(currentEvent.timestampMs)}ms</span>
            </div>

            <div className="replay-structured-body">
              <div className="replay-section-title">Execution Event Data</div>
              {renderPayloadSummary(currentEvent.payload)}
            </div>

            <div className="replay-raw-toggle-wrap">
              <button
                type="button"
                className="btn-replay-toggle"
                onClick={() => setShowRawDetails((prev) => !prev)}
              >
                {showRawDetails ? 'Hide Technical JSON' : 'Show Technical JSON'}
              </button>
              {showRawDetails && (
                <pre className="replay-payload cell-mono">
                  {JSON.stringify(currentEvent.payload, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ) : (
          <p className="state-message">No events recorded for this run.</p>
        )}
      </div>
    </Modal>
  );
}
