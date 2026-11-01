import type { TrialConfig } from '@chaosboard/contracts';
import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';

export interface TrialProgressCardProps {
  readonly status: 'idle' | 'starting' | 'running' | 'completed' | 'cancelled' | 'failed' | 'busy';
  readonly currentTrial: number;
  readonly totalTrials: number;
  readonly errorMessage: string | null;
  readonly runId: string | null;
  readonly config?: TrialConfig;
}

export function TrialProgressCard({
  status,
  currentTrial,
  totalTrials,
  errorMessage,
  runId,
  config,
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
      title="Resilience Execution"
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
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Simulation Completed</span>
          </div>
          <p className="execution-completed-text">
            All {String(totalTrials)} trials recorded. Baseline steady-state and fault injection tail metrics are plotted below.
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

      {/* 3. Failed or Cancelled State */}
      {(status === 'failed' || status === 'cancelled') && (
        <div className="execution-halted-container">
          <span className="execution-halted-title">
            {status === 'failed' ? 'Execution Error' : 'Simulation Cancelled'}
          </span>
          <p className="execution-halted-message">
            {errorMessage ?? (status === 'cancelled' ? 'Simulation stopped by user.' : 'An error occurred during execution.')}
          </p>
        </div>
      )}

      {/* 4. Idle Ready State */}
      {status === 'idle' && (
        <div className="execution-idle-container">
          <p className="execution-idle-title">Ready for resilience simulation</p>
          <p className="execution-idle-subtext">
            Executes baseline calibration followed by chaos fault injection to measure p99 latency regressions and invariant violations.
          </p>
          <div className="execution-kpi-grid">
            <div className="execution-kpi-cell">
              <span className="kpi-label">Planned Trials</span>
              <span className="kpi-value">{String(totalTrials || 6)} ({String(Math.ceil((totalTrials || 6) / 2))} base / {String(Math.floor((totalTrials || 6) / 2))} fault)</span>
            </div>
            <div className="execution-kpi-cell">
              <span className="kpi-label">Configured Load</span>
              <span className="kpi-value">{String(config?.arrivalRateRps ?? 10)} RPS</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
