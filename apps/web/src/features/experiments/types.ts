import type {
  Fault,
  Invariant,
  InvariantVerdict,
  RunEvent,
  RunId,
  RunRecord,
  TrialConfig,
  VerdictStatus,
} from '@chaosboard/contracts';

export interface ExperimentTelemetryPoint {
  readonly timestampMs: number;
  readonly p50LatencyMs?: number | undefined;
  readonly p95LatencyMs?: number | undefined;
  readonly p99LatencyMs?: number | undefined;
  readonly errorRate?: number | undefined;
}

export interface ExperimentSessionState {
  readonly runId: RunId | null;
  readonly status: 'idle' | 'starting' | 'running' | 'completed' | 'cancelled' | 'failed' | 'busy';
  readonly fault: Fault;
  readonly invariants: readonly Invariant[];
  readonly trialConfig: TrialConfig;
  readonly currentTrialIndex: number;
  readonly totalTrials: number;
  readonly liveEvents: readonly RunEvent[];
  readonly telemetry: readonly ExperimentTelemetryPoint[];
  readonly finalRecord: RunRecord | null;
  readonly verdicts: readonly InvariantVerdict[] | null;
  readonly overallStatus: VerdictStatus | null;
  readonly errorMessage: string | null;
}
