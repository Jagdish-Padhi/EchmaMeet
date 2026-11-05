import type {
  EdgeId,
  MetricAggregate,
  NodeId,
  TrialAggregate,
  TrialResult,
} from '@chaosboard/contracts';

export function computeMedianAndIQR(values: readonly number[]): MetricAggregate {
  if (values.length === 0) {
    return { median: null, p25: null, p75: null, iqr: null };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const getPercentile = (p: number): number => {
    if (n === 1) {
      return sorted[0] ?? 0;
    }
    const index = (p / 100) * (n - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    const lowerVal = sorted[lower] ?? 0;
    const upperVal = sorted[upper] ?? 0;
    return lowerVal + (upperVal - lowerVal) * weight;
  };

  const p25 = Math.round(getPercentile(25) * 100) / 100;
  const p75 = Math.round(getPercentile(75) * 100) / 100;
  const median = Math.round(getPercentile(50) * 100) / 100;
  const iqr = Math.round((p75 - p25) * 100) / 100;

  return { median, p25, p75, iqr };
}

export function aggregateTrialResults(trials: readonly TrialResult[]): TrialAggregate {
  const trialsCount = trials.length;
  const validTrials = trials.filter((t) => t.validity.valid);
  const validTrialsCount = validTrials.length;
  const invalidTrials = trials.filter((t) => !t.validity.valid);
  const invalidTrialsCount = invalidTrials.length;

  const invalidReasons = invalidTrials
    .map((t) => t.validity.reason)
    .filter((r): r is string => r !== null);

  const p99Values: number[] = [];
  const p50Values: number[] = [];
  const completionValues: number[] = [];
  const duplicateValues: number[] = [];

  const retryByEdge: Record<EdgeId, number[]> = {};
  const breakerByEdge: Record<EdgeId, number[]> = {};
  const saturationByNode: Record<NodeId, number[]> = {};
  const queueByNode: Record<NodeId, number[]> = {};

  for (const trial of validTrials) {
    const { metrics } = trial;

    if (metrics.p99LatencyMs !== null) {
      p99Values.push(metrics.p99LatencyMs);
    }
    if (metrics.p50LatencyMs !== null) {
      p50Values.push(metrics.p50LatencyMs);
    }
    completionValues.push(metrics.completionRate);

    if (metrics.duplicateWriteRate !== null) {
      duplicateValues.push(metrics.duplicateWriteRate);
    }

    for (const [edgeId, val] of Object.entries(metrics.retryAmplification)) {
      const arr = retryByEdge[edgeId as EdgeId] ?? [];
      arr.push(val);
      retryByEdge[edgeId as EdgeId] = arr;
    }

    for (const [edgeId, val] of Object.entries(metrics.breakerOpenFraction)) {
      const arr = breakerByEdge[edgeId as EdgeId] ?? [];
      arr.push(val);
      breakerByEdge[edgeId as EdgeId] = arr;
    }

    for (const [nodeId, val] of Object.entries(metrics.workerSaturation)) {
      const arr = saturationByNode[nodeId as NodeId] ?? [];
      arr.push(val);
      saturationByNode[nodeId as NodeId] = arr;
    }

    for (const [nodeId, val] of Object.entries(metrics.maxQueueDepth)) {
      const arr = queueByNode[nodeId as NodeId] ?? [];
      arr.push(val);
      queueByNode[nodeId as NodeId] = arr;
    }
  }

  const retryAmplification: Record<EdgeId, MetricAggregate> = {};
  for (const [edgeId, vals] of Object.entries(retryByEdge)) {
    retryAmplification[edgeId as EdgeId] = computeMedianAndIQR(vals);
  }

  const breakerOpenFraction: Record<EdgeId, MetricAggregate> = {};
  for (const [edgeId, vals] of Object.entries(breakerByEdge)) {
    breakerOpenFraction[edgeId as EdgeId] = computeMedianAndIQR(vals);
  }

  const workerSaturation: Record<NodeId, MetricAggregate> = {};
  for (const [nodeId, vals] of Object.entries(saturationByNode)) {
    workerSaturation[nodeId as NodeId] = computeMedianAndIQR(vals);
  }

  const maxQueueDepth: Record<NodeId, MetricAggregate> = {};
  for (const [nodeId, vals] of Object.entries(queueByNode)) {
    maxQueueDepth[nodeId as NodeId] = computeMedianAndIQR(vals);
  }

  return {
    trialsCount,
    validTrialsCount,
    invalidTrialsCount,
    invalidReasons,
    metrics: {
      p99LatencyMs: computeMedianAndIQR(p99Values),
      p50LatencyMs: computeMedianAndIQR(p50Values),
      completionRate: computeMedianAndIQR(completionValues),
      retryAmplification,
      workerSaturation,
      maxQueueDepth,
      duplicateWriteRate: computeMedianAndIQR(duplicateValues),
      breakerOpenFraction,
    },
  };
}
