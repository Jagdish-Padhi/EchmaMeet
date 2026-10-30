import type {
  InvariantVerdict,
  RunEvent,
  RunId,
  RunRecord,
  RunStatus,
  RunSummary,
  TrialAggregate,
  TrialResult,
  VerdictStatus,
} from '@chaosboard/contracts';

export interface UpdateRunDetails {
  finishedAt?: string;
  errorMessage?: string | null;
  baselineAggregate?: TrialAggregate | null;
  faultedAggregate?: TrialAggregate | null;
  verdicts?: InvariantVerdict[];
  overallStatus?: VerdictStatus | null;
}

export interface RunsRepositoryPort {
  createRun(run: RunRecord): void;
  updateRunStatus(id: RunId, status: RunStatus, details?: UpdateRunDetails): void;
  appendEvent(event: RunEvent): void;
  appendTrial(runId: RunId, phase: 'baseline' | 'faulted', trialResult: TrialResult): void;
  getRun(id: RunId): RunRecord | null;
  listRuns(limit?: number): RunSummary[];
  getEvents(runId: RunId): RunEvent[];
  getTrials(runId: RunId): { baseline: TrialResult[]; faulted: TrialResult[] };
}
