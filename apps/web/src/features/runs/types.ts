import type { RunEvent, RunId, RunRecord } from '@chaosboard/contracts';

export interface RunsHistoryState {
  readonly runs: readonly RunRecord[];
  readonly selectedRunId: RunId | null;
  readonly selectedRunRecord: RunRecord | null;
  readonly replayingEvents: readonly RunEvent[] | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}
