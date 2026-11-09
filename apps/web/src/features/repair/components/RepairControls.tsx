import type { EdgeId, Fault, RepairProposerKind, RepairStatus, Topology } from '@chaosboard/contracts';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';

export interface RepairControlsProps {
  readonly status: RepairStatus | 'idle' | 'starting';
  readonly proposerKind: RepairProposerKind;
  readonly maxIterations: number;
  readonly errorMessage?: string | null | undefined;
  readonly currentTopology?: Topology | null | undefined;
  readonly activeFault?: Fault | undefined;
  readonly onFaultChange?: ((fault: Fault) => void) | undefined;
  readonly onProposerChange: (kind: RepairProposerKind) => void;
  readonly onMaxIterationsChange: (max: number) => void;
  readonly onStart: () => void;
  readonly onCancel: () => void;
  readonly onReset?: (() => void) | undefined;
  readonly onApplyPatches?: (() => void) | undefined;
  readonly onExportIaC?: (() => void) | undefined;
  readonly hasBestTopology?: boolean | undefined;
  readonly canStart: boolean;
}

export function RepairControls({
  status,
  proposerKind,
  maxIterations,
  errorMessage,
  currentTopology,
  activeFault,
  onFaultChange,
  onProposerChange,
  onMaxIterationsChange,
  onStart,
  onCancel,
  onReset,
  onApplyPatches,
  onExportIaC,
  hasBestTopology,
  canStart,
}: RepairControlsProps) {
  const isRunning = status === 'running' || status === 'starting';
  const isFailed = status === 'failed';
  const isRepaired = status === 'repaired';
  const isTradeOff = status === 'trade_off_reached';

  const edges = currentTopology?.edges ?? [];
  const selectedEdgeId = activeFault?.edgeId ?? edges[0]?.id;

  const handleEdgeChange = (newEdgeId: string) => {
    if (!activeFault || !onFaultChange) return;
    onFaultChange({
      ...activeFault,
      edgeId: newEdgeId as EdgeId,
    });
  };

  const handleFaultProfileChange = (profile: string) => {
    if (!activeFault || !onFaultChange) return;
    if (profile === 'latency_800') {
      onFaultChange({
        id: activeFault.id,
        edgeId: activeFault.edgeId,
        direction: activeFault.direction,
        startOffsetMs: activeFault.startOffsetMs,
        toxicity: 1,
        type: 'latency',
        latencyMs: 800,
        jitterMs: 100,
      });
    } else if (profile === 'spike_1500') {
      onFaultChange({
        id: activeFault.id,
        edgeId: activeFault.edgeId,
        direction: activeFault.direction,
        startOffsetMs: activeFault.startOffsetMs,
        toxicity: 1,
        type: 'latency',
        latencyMs: 1500,
        jitterMs: 250,
      });
    } else if (profile === 'reset_drop') {
      onFaultChange({
        id: activeFault.id,
        edgeId: activeFault.edgeId,
        direction: activeFault.direction,
        startOffsetMs: activeFault.startOffsetMs,
        toxicity: 1,
        type: 'connection_reset',
        afterMs: 50,
      });
    } else if (profile === 'stall_1200') {
      onFaultChange({
        id: activeFault.id,
        edgeId: activeFault.edgeId,
        direction: activeFault.direction,
        startOffsetMs: activeFault.startOffsetMs,
        toxicity: 1,
        type: 'stall',
        holdMs: 1200,
      });
    }
  };

  const currentProfile =
    activeFault?.type === 'latency' && activeFault.latencyMs === 1500
      ? 'spike_1500'
      : activeFault?.type === 'connection_reset'
        ? 'reset_drop'
        : activeFault?.type === 'stall'
          ? 'stall_1200'
          : 'latency_800';

  const hasEdges = edges.length > 0;
  const optimizationBlocked = !canStart || !hasEdges;

  return (
    <Card
      title="Autonomous Resilience Optimizer"
      actions={<StatusPill status={status} />}
      className="repair-controls-card"
    >
      <div className="repair-controls-content">
        {/* Failure Diagnostic & Quick Recovery */}
        {isFailed && (
          <div className="optimizer-banner-failed">
            <Alert variant="error" title="Resilience Optimization Blocked">
              <p className="optimizer-error-message">
                {errorMessage ||
                  'The optimization loop halted because the initial baseline run could not verify invariants.'}
              </p>
              <div className="optimizer-banner-actions">
                {onReset && (
                  <Button variant="secondary" onClick={onReset}>
                    Reset Optimizer
                  </Button>
                )}
                <Button variant="primary" onClick={onStart} disabled={optimizationBlocked}>
                  Retry Optimization
                </Button>
              </div>
            </Alert>
          </div>
        )}

        {/* Success / Applied Patches Banner */}
        {(isRepaired || (isTradeOff && hasBestTopology)) && (
          <div className="optimizer-banner-repaired">
            <div className="repaired-header">
              <span className="repaired-indicator" />
              <div className="repaired-text">
                <strong className="repaired-title">
                  {isRepaired ? 'Optimal Resilience Configuration Discovered' : 'Pareto Trade-Off Boundary Reached'}
                </strong>
                <p className="repaired-subtitle">
                  {isRepaired
                    ? 'All service-level invariants satisfied without breaking downstream SLAs.'
                    : 'Best trade-off configuration discovered. Review recommendations below.'}
                </p>
              </div>
            </div>

            <div className="repaired-actions">
              {onApplyPatches && hasBestTopology && (
                <Button variant="primary" onClick={onApplyPatches}>
                  Apply to Whiteboard
                </Button>
              )}
              {onExportIaC && (
                <Button variant="secondary" onClick={onExportIaC}>
                  Export IaC Manifests
                </Button>
              )}
              {onReset && (
                <Button variant="ghost" onClick={onReset}>
                  New Run
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Configuration Grid */}
        <div className="repair-config-grid">
          {/* Target Stress Edge */}
          <div className="field-group">
            <span className="field-label">Target Connection</span>
            {hasEdges ? (
              <select
                className="input-select"
                value={selectedEdgeId}
                disabled={isRunning}
                onChange={(e) => handleEdgeChange(e.target.value)}
              >
                {edges.map((edge) => (
                  <option key={edge.id} value={edge.id}>
                    {edge.source} → {edge.target} ({edge.id})
                  </option>
                ))}
              </select>
            ) : (
              <div className="edge-empty-notice">
                Connect at least two services on canvas to target
              </div>
            )}
            <span className="field-help-text">
              The service dependency path to subject to chaos conditions.
            </span>
          </div>

          {/* Fault Profile Selection */}
          <div className="field-group">
            <span className="field-label">Stress Failure Profile</span>
            <select
              className="input-select"
              value={currentProfile}
              disabled={isRunning || !hasEdges}
              onChange={(e) => handleFaultProfileChange(e.target.value)}
            >
              <option value="latency_800">Downstream Latency (800ms + 100ms jitter)</option>
              <option value="spike_1500">Severe Latency Spike (1500ms + 250ms jitter)</option>
              <option value="reset_drop">Connection Reset &amp; Drop (TCP reset at 50ms)</option>
              <option value="stall_1200">Connection Stall / Blackhole (1200ms hold)</option>
            </select>
            <span className="field-help-text">
              Underlying degradation tested against circuit breakers and retries.
            </span>
          </div>

          {/* Strategy Selection */}
          <div className="field-group">
            <span className="field-label">Optimization Strategy</span>
            <select
              className="input-select"
              value={proposerKind}
              disabled={isRunning}
              onChange={(e) => onProposerChange(e.target.value as RepairProposerKind)}
            >
              <option value="model">Adaptive AI Optimizer (Trace-guided policy synthesis)</option>
              <option value="rule_based">Deterministic SRE Rules (Exponential backoff &amp; breaker heuristics)</option>
            </select>
            <span className="field-help-text">
              {proposerKind === 'model'
                ? 'Synthesizes targeted policies from latency percentiles and error metrics.'
                : 'Deterministic heuristics apply production golden-ratio retry and breaker limits.'}
            </span>
          </div>

          {/* Search Budget */}
          <div className="field-group">
            <span className="field-label">Iteration Budget</span>
            <div className="iteration-budget-segmented">
              {[3, 5, 10].map((count) => (
                <button
                  key={count}
                  type="button"
                  disabled={isRunning}
                  className={`budget-button ${maxIterations === count ? 'active' : ''}`}
                  onClick={() => onMaxIterationsChange(count)}
                >
                  {count} Trials
                </button>
              ))}
            </div>
            <span className="field-help-text">
              Stops earlier if all SLO invariants pass before budget exhausted.
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="repair-actions-footer">
          {isRunning ? (
            <div className="optimizer-running-state">
              <div className="optimizer-progress-meta">
                <span className="optimizer-pulse" />
                <span className="optimizer-running-label">
                  Evaluating architecture resilience &amp; probing policies...
                </span>
              </div>
              <Button variant="danger" onClick={onCancel} className="btn-full-width">
                Cancel Optimization
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              disabled={optimizationBlocked}
              onClick={onStart}
              className="btn-full-width"
              title={
                optimizationBlocked
                  ? 'Connect at least two services and resolve topology validation warnings'
                  : 'Start autonomous resilience optimization loop'
              }
            >
              Run Autonomous Optimizer
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
