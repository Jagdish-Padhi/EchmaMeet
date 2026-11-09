import type { TrialConfig } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';
import { Button } from '../../../components/ui/Button';

export interface TrialProgressCardProps {
  readonly status: 'idle' | 'starting' | 'running' | 'completed' | 'cancelled' | 'failed' | 'busy';
  readonly currentTrial: number;
  readonly totalTrials: number;
  readonly errorMessage: string | null;
  readonly runId: string | null;
  readonly config?: TrialConfig | undefined;
  readonly onOpenDiagnostics?: (() => void) | undefined;
  readonly onForceReset?: (() => void) | undefined;
  readonly onRetry?: (() => void) | undefined;
}

export function TrialProgressCard({
  status,
  currentTrial,
  totalTrials,
  errorMessage,
  runId,
  config,
  onOpenDiagnostics,
  onForceReset,
  onRetry,
}: TrialProgressCardProps) {
  const effectiveTrial = currentTrial === 0 && status === 'running' ? 1 : currentTrial;
  const progressPercent =
    totalTrials > 0 && status === 'running'
      ? Math.min(100, Math.max(5, Math.round((effectiveTrial / totalTrials) * 100)))
      : status === 'completed'
        ? 100
        : 0;

  const halfTrials = Math.ceil(totalTrials / 2);
  const isBaselinePhase = currentTrial <= halfTrials;

  return (
    <Card
      title="Execution Status"
      actions={
        <div className="simulation-header-actions">
          {runId && <span className="cell-mono run-id-tag">run:{runId.slice(0, 8)}</span>}
          <StatusPill status={status} />
        </div>
      }
      className="agentic-simulation-card"
    >
      {/* 1. Active Running State */}
      {(status === 'running' || status === 'starting') && (
        <div className="execution-running-container">
          <div className="execution-phase-banner">
            <span className="agentic-pulse-spinner" />
            <span className="execution-phase-title">
              {status === 'starting'
                ? 'Initializing Execution Sandbox...'
                : isBaselinePhase
                  ? `Phase 1: Baseline Calibration (Trial ${String(currentTrial)}/${String(totalTrials)})`
                  : `Phase 2: Chaos Fault Injection (Trial ${String(currentTrial)}/${String(totalTrials)})`}
            </span>
          </div>

          <div className="agentic-progress-container">
            <div className="agentic-progress-meta">
              <span>Overall Progress</span>
              <span className="agentic-progress-pct">{String(progressPercent)}%</span>
            </div>
            <div className="agentic-progress-track">
              <div
                className="agentic-progress-fill"
                style={{ width: `${String(progressPercent)}%` }}
              />
            </div>
          </div>

          <div className="execution-kpi-grid">
            <div className="execution-kpi-cell">
              <span className="kpi-label">Target Rate</span>
              <span className="kpi-value">{String(config?.arrivalRateRps ?? 10)} RPS</span>
            </div>
            <div className="execution-kpi-cell">
              <span className="kpi-label">Sample Window</span>
              <span className="kpi-value">{String(config?.measurementMs ?? 5000)}ms</span>
            </div>
            <div className="execution-kpi-cell">
              <span className="kpi-label">Current Phase</span>
              <span className="kpi-value highlight">
                {isBaselinePhase ? 'Steady State' : 'Fault Active'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Completed State */}
      {status === 'completed' && (
        <div className="execution-completed-container">
          <div className="execution-completed-badge">
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Simulation Completed</span>
          </div>
          <p className="execution-completed-text">
            All {String(totalTrials)} trials completed across baseline and fault phases.
          </p>
          <div className="execution-kpi-grid">
            <div className="execution-kpi-cell">
              <span className="kpi-label">Total Trials</span>
              <span className="kpi-value">{String(totalTrials)}</span>
            </div>
            <div className="execution-kpi-cell">
              <span className="kpi-label">Load Rate</span>
              <span className="kpi-value">{String(config?.arrivalRateRps ?? 10)} RPS</span>
            </div>
            <div className="execution-kpi-cell">
              <span className="kpi-label">Window</span>
              <span className="kpi-value">{String(config?.measurementMs ?? 5000)}ms</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Host Busy State */}
      {status === 'busy' && (
        <div
          className="execution-halted-container"
          style={{ borderLeft: '3px solid #f59e0b', background: 'rgba(245, 158, 11, 0.08)' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
            }}
          >
            <span className="execution-halted-title" style={{ color: '#fbbf24' }}>
              Execution Lock Held (Host Busy)
            </span>
            {onOpenDiagnostics && (
              <button
                type="button"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#38bdf8',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
                onClick={onOpenDiagnostics}
              >
                Diagnostics & Checks
              </button>
            )}
          </div>
          <p className="execution-halted-message" style={{ margin: '0 0 10px 0' }}>
            {errorMessage ??
              'Single-host process isolation lock is active. Another simulation is executing or releasing sandbox ports.'}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {onRetry && (
              <Button variant="secondary" size="sm" onClick={onRetry}>
                Try Running Again
              </Button>
            )}
            {onForceReset && (
              <Button variant="danger" size="sm" onClick={onForceReset}>
                Force Release Lock
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 4. Failed or Cancelled State */}
      {(status === 'failed' || status === 'cancelled') && (
        <div className="execution-halted-container">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
            }}
          >
            <span className="execution-halted-title">
              {status === 'failed' ? 'Execution Error' : 'Simulation Cancelled'}
            </span>
            {status === 'failed' && onOpenDiagnostics && (
              <button
                type="button"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#38bdf8',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
                onClick={onOpenDiagnostics}
              >
                Inspect Cause & Settings
              </button>
            )}
          </div>
          <p className="execution-halted-message" style={{ margin: '0 0 10px 0' }}>
            {errorMessage ??
              (status === 'cancelled'
                ? 'Simulation stopped by user.'
                : 'An error occurred during execution.')}
          </p>
          {status === 'failed' && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {onRetry && (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  Retry Simulation
                </Button>
              )}
              {onForceReset && (
                <Button variant="ghost" size="sm" onClick={onForceReset}>
                  Reset Lock
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Idle Ready State */}
      {status === 'idle' && (
        <div className="execution-idle-container">
          <div className="execution-kpi-grid">
            <div className="execution-kpi-cell">
              <span className="kpi-label">Planned Trials</span>
              <span className="kpi-value">{String(totalTrials || 6)}</span>
              <span className="kpi-subtext">
                {String(Math.ceil((totalTrials || 6) / 2))} base · {String(Math.floor((totalTrials || 6) / 2))} fault
              </span>
            </div>
            <div className="execution-kpi-cell">
              <span className="kpi-label">Target Load</span>
              <span className="kpi-value">{String(config?.arrivalRateRps ?? 10)} RPS</span>
              <span className="kpi-subtext">open-loop</span>
            </div>
            <div className="execution-kpi-cell">
              <span className="kpi-label">Sample Window</span>
              <span className="kpi-value">{((config?.measurementMs ?? 5000) / 1000).toFixed(1)}s</span>
              <span className="kpi-subtext">per trial</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
