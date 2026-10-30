import type { VerdictStatus } from '@chaosboard/contracts';

export type StatusKind =
  | VerdictStatus
  | 'idle'
  | 'starting'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'busy'
  | 'repaired'
  | 'trade_off'
  | 'trade_off_reached'
  | 'limits_reached';

export interface StatusPillProps {
  readonly status: StatusKind;
  readonly label?: string;
}

export function StatusPill({ status, label }: StatusPillProps) {
  const displayLabel = label ?? status.toUpperCase();

  const getAriaDescription = (s: StatusKind): string => {
    switch (s) {
      case 'PASS':
        return 'Status: passed all invariants';
      case 'VIOLATED':
        return 'Status: violated invariants';
      case 'INCONCLUSIVE':
        return 'Status: inconclusive outcome';
      case 'INVALID':
        return 'Status: invalid trial or measurement';
      case 'idle':
        return 'Status: idle';
      case 'starting':
        return 'Status: initializing execution';
      case 'running':
        return 'Status: currently running';
      case 'completed':
        return 'Status: completed';
      case 'busy':
        return 'Status: host is busy with another experiment';
      case 'cancelled':
        return 'Status: run was cancelled';
      case 'failed':
        return 'Status: execution encountered an error';
      case 'repaired':
        return 'Status: repair succeeded';
      case 'trade_off':
      case 'trade_off_reached':
        return 'Status: Pareto trade-off identified';
      case 'limits_reached':
        return 'Status: iteration limits reached';
    }
  };

  return (
    <span
      className={`status-pill status-${status.toLowerCase()}`}
      role="status"
      aria-label={getAriaDescription(status)}
    >
      <span className="status-marker" aria-hidden="true" />
      <span className="status-text">{displayLabel}</span>
    </span>
  );
}
