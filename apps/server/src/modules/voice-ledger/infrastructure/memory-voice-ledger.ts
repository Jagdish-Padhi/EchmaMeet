import type { LedgerAnalytics, VoiceLedgerEntry, VoiceLedgerPort } from '../application/ports';

const CAP = 500;

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return a + (b - a) * (idx - lo);
}

function tally<T extends string>(values: readonly T[]): { key: T; count: number }[] {
  const map = new Map<T, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

/** Bounded in-process ledger used when DATABASE_URL is not set. */
export class MemoryVoiceLedger implements VoiceLedgerPort {
  readonly backend = 'memory' as const;
  private entries: VoiceLedgerEntry[] = [];

  record(entry: VoiceLedgerEntry): Promise<void> {
    if (this.entries.some((x) => x.id === entry.id)) return Promise.resolve();
    this.entries.push(entry);
    if (this.entries.length > CAP) this.entries.splice(0, this.entries.length - CAP);
    return Promise.resolve();
  }

  recent(limit: number): Promise<readonly VoiceLedgerEntry[]> {
    return Promise.resolve([...this.entries].reverse().slice(0, limit));
  }

  analytics(): Promise<LedgerAnalytics> {
    const e = this.entries;
    const stt = e
      .filter((x) => x.sttMs > 0)
      .map((x) => x.sttMs)
      .sort((a, b) => a - b);
    const nonEmpty = e.filter((x) => x.status !== 'empty');
    return Promise.resolve({
      total: e.length,
      byLanguage: tally(e.map((x) => x.language)).map((t) => ({ language: t.key, count: t.count })),
      byStatus: tally(e.map((x) => x.status)).map((t) => ({ status: t.key, count: t.count })),
      byCommand: tally(e.flatMap((x) => (x.commandType ? [x.commandType] : []))).map((t) => ({
        command: t.key,
        count: t.count,
      })),
      sttLatencyMs: stt.length
        ? { p50: Math.round(percentile(stt, 0.5)), p95: Math.round(percentile(stt, 0.95)) }
        : null,
      successRatePct: nonEmpty.length
        ? Math.round(
            (nonEmpty.filter((x) => x.status === 'parsed').length / nonEmpty.length) * 1000,
          ) / 10
        : null,
    });
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}
