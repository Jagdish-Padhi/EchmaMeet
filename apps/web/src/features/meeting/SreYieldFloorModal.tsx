import type { EdgeId, EdgePolicy } from '@chaosboard/contracts';
import { createPortal } from 'react-dom';
import { Button } from '../../components/ui/Button';
import type { SreHazard } from './types';

export interface SreYieldFloorModalProps {
  readonly isOpen: boolean;
  readonly hazards: readonly SreHazard[];
  readonly onClose: () => void;
  readonly onApplyPatch: (
    edgeId?: EdgeId,
    patch?: Partial<EdgePolicy>,
    hazardId?: string,
  ) => void;
  readonly onRunProof: (targetEdgeId: EdgeId) => void;
}

export function SreYieldFloorModal({
  isOpen,
  hazards,
  onClose,
  onApplyPatch,
  onRunProof,
}: SreYieldFloorModalProps) {
  if (!isOpen || hazards.length === 0) return null;

  const currentHazard = hazards[0];
  if (!currentHazard) return null;

  const modalElement = (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="sre-yield-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sre-hazard-title"
      >
        {/* Header */}
        <div className="sre-modal-header">
          <div className="sre-agent-identity">
            <div className="sre-agent-emblem">
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
            </div>
            <div>
              <div className="sre-agent-name">Echma</div>
              <div className="sre-agent-subtitle">AI Principal SRE &bull; Gnani voice</div>
            </div>
          </div>
          <button
            type="button"
            className="btn-close-drawer"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* Hazard Body */}
        <div className="sre-modal-body">
          <div className="hazard-severity-pill critical">
            <span>High Risk Finding</span>
          </div>

          <h3 id="sre-hazard-title" className="sre-hazard-heading">
            {currentHazard.title}
          </h3>

          <div className="sre-speech-bubble">
            <p className="sre-speech-text">{currentHazard.risk}</p>
          </div>

          <div className="sre-recommendation-box">
            <div className="recommendation-header">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span>Recommended Fix</span>
            </div>
            <p className="recommendation-text">{currentHazard.recommendation}</p>
          </div>

          {hazards.length > 1 && (
            <div className="sre-additional-hazards-note">
              +{hazards.length - 1} other issue(s) found in this architecture.
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="sre-modal-footer">
          {currentHazard.targetEdgeId && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onRunProof(currentHazard.targetEdgeId as EdgeId);
                onClose();
              }}
              title="Run simulation to test this failure live"
            >
              Simulate Failure (5s)
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onApplyPatch(
                currentHazard.targetEdgeId as EdgeId | undefined,
                currentHazard.patch as Partial<EdgePolicy> | undefined,
                currentHazard.id,
              );
              onClose();
            }}
            title="Automatically update architecture with recommended resilience settings"
          >
            Apply Fix
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onApplyPatch(
                currentHazard.targetEdgeId as EdgeId | undefined,
                currentHazard.patch as Partial<EdgePolicy> | undefined,
                currentHazard.id,
              );
              if (currentHazard.targetEdgeId) {
                onRunProof(currentHazard.targetEdgeId as EdgeId);
              }
              onClose();
            }}
            title="Apply fix and run simulation to verify resilience live"
            style={{
              background: '#0284c7',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            Remediate &amp; Verify (5s)
          </Button>

          <Button variant="ghost" size="sm" onClick={onClose}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalElement, document.body);
  }

  return modalElement;
}
