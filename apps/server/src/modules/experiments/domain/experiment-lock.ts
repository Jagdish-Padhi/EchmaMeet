import { AppError } from '@chaosboard/shared';
import type { RunId } from '@chaosboard/contracts';

export class ExperimentLock {
  private activeRunId: RunId | null = null;

  acquire(runId: RunId): void {
    if (this.activeRunId !== null) {
      throw new AppError(
        'conflict',
        'experiment_busy',
        `An experiment is already running (run ID: ${this.activeRunId}). Only one experiment can run at a time.`,
      );
    }
    this.activeRunId = runId;
  }

  release(runId: RunId): void {
    if (this.activeRunId === runId) {
      this.activeRunId = null;
    }
  }

  forceRelease(): void {
    this.activeRunId = null;
  }

  isLocked(): boolean {
    return this.activeRunId !== null;
  }

  getActiveRunId(): RunId | null {
    return this.activeRunId;
  }
}
