export interface QueueItem {
  readonly requestId: string;
  readonly attemptIndex: number;
  readonly idempotencyKey: string | null;
  readonly payload: unknown;
  readonly enqueuedAtMs: number;
}

export class QueueConsumerWorker {
  private readonly queue: QueueItem[] = [];
  private intervalTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly consumeRateRps: number,
    private readonly onProcessItem: (item: QueueItem) => Promise<void>,
  ) {}

  enqueue(item: QueueItem): void {
    this.queue.push(item);
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  start(): void {
    if (this.intervalTimer !== null) {
      return;
    }
    const intervalMs = Math.max(1, Math.round(1000 / this.consumeRateRps));
    this.intervalTimer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.intervalTimer.unref();
  }

  stop(): void {
    if (this.intervalTimer !== null) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }
    const item = this.queue.shift();
    if (!item) {
      return;
    }

    this.isProcessing = true;
    try {
      await this.onProcessItem(item);
    } finally {
      this.isProcessing = false;
    }
  }

  clear(): void {
    this.queue.length = 0;
  }
}

