import type { RunEvent, RunId, RunRecord, RunSummary } from '@chaosboard/contracts';

export type RunHistoryItem = RunRecord | RunSummary;

export interface RunsHistoryState {
  readonly runs: readonly RunHistoryItem[];
  readonly selectedRunId: RunId | null;
  readonly selectedRunRecord: RunRecord | null;
  readonly replayingEvents: readonly RunEvent[] | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}
