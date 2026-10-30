import { Alert } from '../../../components/ui/Alert';
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
  runId,
}: TrialProgressCardProps) {
  return (
    <Card title="Execution Status" className="status-card">
      <div className="status-header-row">
        <StatusPill status={status} />
        {runId && <span className="run-id-tag">Run: {runId}</span>}
      </div>

      {status === 'busy' && (
        <Alert variant="warning" title="Host Lock Active">
          {errorMessage ??
            'Another experiment process is currently running on this host. Wait for it to finish or check active runs.'}
        </Alert>
      )}

      {status === 'failed' && (
        <Alert variant="error" title="Experiment Execution Failed">
          {errorMessage ?? 'An unhandled error occurred during sandbox execution.'}
        </Alert>
      )}

      {status === 'cancelled' && (
        <Alert variant="info" title="Experiment Cancelled">
          Execution was halted and all worker processes and Toxiproxy links were cleanly torn down.
        </Alert>
      )}

      {(status === 'running' || status === 'starting') && (
        <div className="progress-details">
          <p>
            Running trial {String(currentTrial)} of {String(totalTrials)}
          </p>
          <span className="subtext">
            Baseline and faulted trials run on isolated ports over real sockets.
          </span>
        </div>
      )}
    </Card>
  );
}
