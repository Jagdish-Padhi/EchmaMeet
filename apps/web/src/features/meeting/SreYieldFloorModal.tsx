import type { EdgeId, EdgePolicy } from '@chaosboard/contracts';
import { Button } from '../../components/ui/Button';
import type { SreHazard } from './types';

export interface SreYieldFloorModalProps {
  readonly isOpen: boolean;
  readonly hazards: readonly SreHazard[];
  readonly onClose: () => void;
  readonly onApplyPatch: (edgeId: EdgeId, patch: Partial<EdgePolicy>) => void;
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

  return (
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
            <div className="sre-agent-emblem">🤖</div>
            <div>
              <div className="sre-agent-name">Meta Spark Open &bull; Autonomous Lead SRE</div>
              <div className="sre-agent-subtitle">Spoken Architectural Hazard Analysis</div>
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
            <span>SEV-1 ARCHITECTURAL RISK</span>
          </div>

          <h3 id="sre-hazard-title" className="sre-hazard-heading">
            {currentHazard.title}
          </h3>

          <div className="sre-speech-bubble">
            <p className="sre-speech-text">
              &ldquo;Team, I noticed this configuration during the review. {currentHazard.risk}
              &rdquo;
            </p>
          </div>

          <div className="sre-recommendation-box">
            <div className="recommendation-header">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span>Empirical Recommendation</span>
            </div>
            <p className="recommendation-text">{currentHazard.recommendation}</p>
          </div>

          {hazards.length > 1 && (
            <div className="sre-additional-hazards-note">
              +{hazards.length - 1} additional architectural hazard(s) flagged across the topology.
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
              title="Spawn sandbox processes and simulate latency to test this failure live"
            >
              ⚡ Run 5s Sandbox Proof
            </Button>
          )}

          {currentHazard.targetEdgeId && currentHazard.patch && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onApplyPatch(
                  currentHazard.targetEdgeId as EdgeId,
                  currentHazard.patch as Partial<EdgePolicy>,
                );
                onClose();
              }}
              title="Automatically update edge policy on canvas with mathematically proven resilience settings"
            >
              🛠️ Apply SRE Patch to Canvas
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={onClose}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
