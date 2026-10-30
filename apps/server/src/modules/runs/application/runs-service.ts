import type {
  RunEvent,
  RunId,
  RunRecord,
  RunStatus,
  RunSummary,
  TrialResult,
} from '@chaosboard/contracts';
import type { RunsRepositoryPort, UpdateRunDetails } from './ports';

export class RunsService {
  constructor(private readonly repository: RunsRepositoryPort) {}

  createRun(run: RunRecord): void {
    this.repository.createRun(run);
  }

  updateRunStatus(id: RunId, status: RunStatus, details?: UpdateRunDetails): void {
    this.repository.updateRunStatus(id, status, details);
  }

  appendEvent(event: RunEvent): void {
    this.repository.appendEvent(event);
  }

  appendTrial(runId: RunId, phase: 'baseline' | 'faulted', trialResult: TrialResult): void {
    this.repository.appendTrial(runId, phase, trialResult);
  }

  getRun(id: RunId): RunRecord | null {
    return this.repository.getRun(id);
  }

  listRuns(limit?: number): RunSummary[] {
    return this.repository.listRuns(limit);
  }

  getEvents(runId: RunId): RunEvent[] {
    return this.repository.getEvents(runId);
  }

  getTrials(runId: RunId): { baseline: TrialResult[]; faulted: TrialResult[] } {
    return this.repository.getTrials(runId);
  }
}
