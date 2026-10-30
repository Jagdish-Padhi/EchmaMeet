export type AcquireResult =
  { status: 'acquired' } | { status: 'queued'; queueDepth: number } | { status: 'rejected_full' };

export class BoundedQueueManager {
  private activeWorkers = 0;
  private queuedCount = 0;

  constructor(
    private readonly maxWorkers: number,
    private readonly maxQueueDepth: number | null, // null means unbounded
  ) {}

  getActiveWorkers(): number {
    return this.activeWorkers;
  }

  getQueueDepth(): number {
    return this.queuedCount;
  }

  tryAcquire(): AcquireResult {
    if (this.activeWorkers < this.maxWorkers) {
      this.activeWorkers++;
      return { status: 'acquired' };
    }

    if (this.maxQueueDepth !== null && this.queuedCount >= this.maxQueueDepth) {
      return { status: 'rejected_full' };
    }

    this.queuedCount++;
    return { status: 'queued', queueDepth: this.queuedCount };
  }

  /**
   * Called when a worker finishes.
   *
   * @returns true if a previously queued worker slot was promoted to active,
   * or false if an active worker slot was freed.
   */
  release(): boolean {
    if (this.queuedCount > 0) {
      this.queuedCount--;
      return true;
    }

    if (this.activeWorkers > 0) {
      this.activeWorkers--;
    }
    return false;
  }
}
