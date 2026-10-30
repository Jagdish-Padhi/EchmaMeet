import type { EdgeId, LoadgenRecord, WorkerCounters, WorkerSeries } from '@chaosboard/contracts';

export interface LatencyPercentiles {
  p50Ms: number | null;
  p90Ms: number | null;
  p99Ms: number | null;
}

export function computeLatencyPercentiles(records: readonly LoadgenRecord[]): LatencyPercentiles {
  const measurementRecords = records.filter(
    (r) => r.phase === 'measurement' && r.durationMs !== null,
  );
  if (measurementRecords.length === 0) {
    return { p50Ms: null, p90Ms: null, p99Ms: null };
  }

  const sorted = measurementRecords.map((r) => r.durationMs as number).sort((a, b) => a - b);
  const getP = (p: number) => {
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    const val = sorted[idx];
    return val !== undefined ? Math.round(val * 100) / 100 : null;
  };

  return {
    p50Ms: getP(50),
    p90Ms: getP(90),
    p99Ms: getP(99),
  };
}

export function computeCompletionRate(records: readonly LoadgenRecord[]): number {
  const measurementRecords = records.filter((r) => r.phase === 'measurement');
  if (measurementRecords.length === 0) {
    return 0;
  }

  const completed = measurementRecords.filter((r) => r.statusClass === 'success_2xx').length;
  return Math.round((completed / measurementRecords.length) * 1000) / 1000;
}

export function computeRetryAmplification(
  startCounters: WorkerCounters,
  endCounters: WorkerCounters,
  edgeId: EdgeId,
): number {
  const attemptsOut =
    (endCounters.attemptsOut[edgeId] ?? 0) - (startCounters.attemptsOut[edgeId] ?? 0);
  const requestsIn = endCounters.requestsIn - startCounters.requestsIn;

  if (requestsIn <= 0) {
    return attemptsOut > 0 ? attemptsOut : 1;
  }

  return Math.round((attemptsOut / requestsIn) * 100) / 100;
}

export function computeWorkerSaturation(series: WorkerSeries, maxWorkers: number): number {
  if (series.samples.length === 0 || maxWorkers <= 0) {
    return 0;
  }

  const saturatedSamples = series.samples.filter((s) => s.busyWorkers >= maxWorkers).length;
  return Math.round((saturatedSamples / series.samples.length) * 1000) / 1000;
}

export function computeMaxQueueDepth(series: WorkerSeries): number {
  if (series.samples.length === 0) {
    return 0;
  }
  return Math.max(...series.samples.map((s) => s.queueDepth));
}

export function computeDuplicateWriteRate(
  startCounters: WorkerCounters,
  endCounters: WorkerCounters,
): number {
  const duplicates = endCounters.ledgerDuplicates - startCounters.ledgerDuplicates;
  const requestsIn = endCounters.requestsIn - startCounters.requestsIn;

  if (requestsIn <= 0) {
    return 0;
  }

  return Math.round((duplicates / requestsIn) * 1000) / 1000;
}
