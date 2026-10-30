export interface LedgerRecord {
  readonly requestId: string;
  readonly idempotencyKey: string | null;
  readonly committedAtMs: number;
}

export class LedgerSinkStore {
  private readonly records: LedgerRecord[] = [];
  private readonly seenKeys = new Set<string>();
  private duplicateCount = 0;

  constructor(private readonly dedupeByKey: boolean) {}

  recordWrite(
    requestId: string,
    idempotencyKey: string | null,
    nowMs: number,
  ): { duplicate: boolean } {
    if (this.dedupeByKey && idempotencyKey !== null && idempotencyKey.length > 0) {
      if (this.seenKeys.has(idempotencyKey)) {
        this.duplicateCount++;
        return { duplicate: true };
      }
      this.seenKeys.add(idempotencyKey);
    }

    this.records.push({
      requestId,
      idempotencyKey,
      committedAtMs: nowMs,
    });
    return { duplicate: false };
  }

  getDuplicateCount(): number {
    return this.duplicateCount;
  }

  getRecords(): readonly LedgerRecord[] {
    return this.records;
  }

  reset(): void {
    this.records.length = 0;
    this.seenKeys.clear();
    this.duplicateCount = 0;
  }
}
