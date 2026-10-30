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

  const currentEvent = events[step];

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
              <span className="event-seq cell-mono">Seq #{String(currentEvent.sequence)}</span>
              <span className="event-type">{currentEvent.type}</span>
              <span className="event-time cell-mono">+{String(currentEvent.timestampMs)}ms</span>
            </div>
            <pre className="replay-payload cell-mono">
              {JSON.stringify(currentEvent.payload, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="state-message">No events recorded for this run.</p>
        )}
      </div>
    </Modal>
  );
}
