import { Card } from '../../../components/ui/Card';
import { StatusPill } from '../../../components/ui/StatusPill';

export interface TrialProgressCardProps {
  readonly status: 'idle' | 'starting' | 'running' | 'completed' | 'cancelled' | 'failed' | 'busy';
  readonly currentTrial: number;
  readonly totalTrials: number;
  readonly errorMessage: string | null;
  readonly runId: string | null;
}

export function TrialProgressCard({
  status,
  currentTrial,
  totalTrials,
  errorMessage,
  runId: _runId,
}: TrialProgressCardProps) {
  // Agentic progress calculations
  const effectiveTrial = currentTrial === 0 && status === 'running' ? 1 : currentTrial;
  const progressPercent =
    totalTrials > 0 && status === 'running'
      ? Math.min(100, Math.max(10, Math.round((effectiveTrial / totalTrials) * 100)))
      : status === 'completed'
        ? 100
        : 0;

  const halfTrials = Math.ceil(totalTrials / 2);

  // Dynamic agentic status phrases like top AI coding engines
  const getAgenticDetails = () => {
    switch (status) {
      case 'starting':
        return {
          title: 'Preparing simulation environment...',
          description: 'Spawning virtual service workers and isolated network sockets.',
        };
      case 'running':
        if (currentTrial === 0) {
          return {
            title: 'Warming up traffic generator...',
            description: 'Establishing socket connections and pre-heating ingress route handlers.',
          };
        }
        if (currentTrial <= halfTrials) {
          return {
            title: `Simulating baseline load (${String(currentTrial)} of ${String(totalTrials)})...`,
            description:
              'Measuring steady-state throughput, error rates, and p99 latency without faults.',
          };
        }
        return {
          title: `Injecting chaos fault (${String(currentTrial)} of ${String(totalTrials)})...`,
          description:
            'Simulating downstream latency spikes to test timeout and circuit breaker policies.',
        };
      case 'completed':
        return {
          title: 'Simulation completed',
          description:
            'All baseline and failure trials finished. Real-time telemetry and verdicts recorded below.',
        };
      case 'cancelled':
        return {
          title: 'Simulation cancelled',
          description: 'Worker processes and synthetic traffic generators cleanly torn down.',
        };
      case 'failed':
        return {
          title: 'Simulation stopped',
          description:
            errorMessage ?? 'An unexpected runtime error occurred during sandbox execution.',
        };
      case 'busy':
        return {
          title: 'Worker host busy',
          description:
            errorMessage ?? 'Another simulation is active on this host. Please wait a moment.',
        };
      case 'idle':
      default:
        return {
          title: 'Ready for simulation',
          description:
            'Click "Run Simulation" in the navbar to test this architecture under load and failure.',
        };
    }
  };

  const agentic = getAgenticDetails();

  return (
    <Card title="Resilience Simulation" className="agentic-simulation-card">
      {/* Top Status & Agentic Activity Header */}
      <div className="agentic-status-header">
        <StatusPill status={status} />
        <div className="agentic-action-badge">
          {(status === 'running' || status === 'starting') && (
            <span className="agentic-pulse-spinner" />
          )}
          {status === 'completed' && <span className="agentic-done-check">✓</span>}
          <span className="agentic-action-title">{agentic.title}</span>
        </div>
      </div>

      {/* Agentic Description Note */}
      <p className="agentic-action-description">{agentic.description}</p>

      {/* Progress Bar (Visible while running or starting) */}
      {(status === 'running' || status === 'starting') && (
        <div className="agentic-progress-container">
          <div className="agentic-progress-meta">
            <span className="agentic-progress-phase">
              Phase {String(effectiveTrial)} of {String(totalTrials)}
            </span>
            <span className="agentic-progress-pct">{String(progressPercent)}%</span>
          </div>
          <div className="agentic-progress-track">
            <div
              className="agentic-progress-fill"
              style={{ width: `${String(progressPercent)}%` }}
            />
          </div>

          {/* Stepper Pipeline */}
          <div className="agentic-step-pipeline">
            <span
              className={`step-chip ${status === 'running' || status === 'starting' ? 'active' : ''}`}
            >
              1. Setup
            </span>
            <span
              className={`step-chip ${
                currentTrial > 0 && currentTrial <= halfTrials
                  ? 'active'
                  : currentTrial > halfTrials
                    ? 'completed'
                    : ''
              }`}
            >
              2. Baseline Load
            </span>
            <span className={`step-chip ${currentTrial > halfTrials ? 'active' : ''}`}>
              3. Chaos Fault
            </span>
            <span className="step-chip">4. Invariants</span>
          </div>
        </div>
      )}
    </Card>
  );
}
