import type {
  Comparator,
  Invariant,
  InvariantVerdict,
  MetricAggregate,
  TrialAggregate,
  TrialResult,
  VerdictEvidence,
  VerdictStatus,
} from '@chaosboard/contracts';

function extractMetricFromAggregate(
  invariant: Invariant,
  aggregate: TrialAggregate,
): MetricAggregate | null {
  const { metric, scope } = invariant;

  switch (metric) {
    case 'e2e_p99_ms':
      return aggregate.metrics.p99LatencyMs;

    case 'completion_rate':
      return aggregate.metrics.completionRate;

    case 'e2e_error_rate': {
      const cr = aggregate.metrics.completionRate;
      if (cr.median === null || cr.p25 === null || cr.p75 === null || cr.iqr === null) {
        return { median: null, p25: null, p75: null, iqr: null };
      }
      return {
        median: Math.round((1 - cr.median) * 1000) / 1000,
        p25: Math.round((1 - cr.p75) * 1000) / 1000,
        p75: Math.round((1 - cr.p25) * 1000) / 1000,
        iqr: cr.iqr,
      };
    }

    case 'retry_amplification': {
      if (scope.kind !== 'edge') return null;
      return aggregate.metrics.retryAmplification[scope.edgeId] ?? null;
    }

    case 'worker_saturation': {
      if (scope.kind !== 'node') return null;
      return aggregate.metrics.workerSaturation[scope.nodeId] ?? null;
    }

    case 'queue_depth_max': {
      if (scope.kind !== 'node') return null;
      return aggregate.metrics.maxQueueDepth[scope.nodeId] ?? null;
    }

    case 'duplicate_write_rate':
      return aggregate.metrics.duplicateWriteRate;

    case 'breaker_open_fraction': {
      if (scope.kind !== 'edge') return null;
      return aggregate.metrics.breakerOpenFraction[scope.edgeId] ?? null;
    }
  }
}

function extractTrialValues(invariant: Invariant, trials: readonly TrialResult[]): number[] {
  const validTrials = trials.filter((t) => t.validity.valid);
  const values: number[] = [];

  for (const t of validTrials) {
    const { metric, scope } = invariant;
    switch (metric) {
      case 'e2e_p99_ms':
        if (t.metrics.p99LatencyMs !== null) values.push(t.metrics.p99LatencyMs);
        break;
      case 'completion_rate':
        values.push(t.metrics.completionRate);
        break;
      case 'e2e_error_rate':
        values.push(Math.round((1 - t.metrics.completionRate) * 1000) / 1000);
        break;
      case 'retry_amplification':
        if (scope.kind === 'edge') {
          const val = t.metrics.retryAmplification[scope.edgeId];
          if (val !== undefined) values.push(val);
        }
        break;
      case 'worker_saturation':
        if (scope.kind === 'node') {
          const val = t.metrics.workerSaturation[scope.nodeId];
          if (val !== undefined) values.push(val);
        }
        break;
      case 'queue_depth_max':
        if (scope.kind === 'node') {
          const val = t.metrics.maxQueueDepth[scope.nodeId];
          if (val !== undefined) values.push(val);
        }
        break;
      case 'duplicate_write_rate':
        if (t.metrics.duplicateWriteRate !== null) values.push(t.metrics.duplicateWriteRate);
        break;
      case 'breaker_open_fraction':
        if (scope.kind === 'edge') {
          const val = t.metrics.breakerOpenFraction[scope.edgeId];
          if (val !== undefined) values.push(val);
        }
        break;
    }
  }

  return values;
}

function checkCondition(val: number, comparator: Comparator, threshold: number): boolean {
  switch (comparator) {
    case 'lt':
      return val < threshold;
    case 'lte':
      return val <= threshold;
    case 'gt':
      return val > threshold;
    case 'gte':
      return val >= threshold;
  }
}

export function evaluateInvariantVerdict(params: {
  invariant: Invariant;
  baselineAggregate: TrialAggregate;
  faultedAggregate: TrialAggregate;
  baselineTrials?: readonly TrialResult[];
  faultedTrials?: readonly TrialResult[];
}): InvariantVerdict {
  const {
    invariant,
    baselineAggregate,
    faultedAggregate,
    baselineTrials = [],
    faultedTrials = [],
  } = params;

  const baselineMetric = extractMetricFromAggregate(invariant, baselineAggregate);
  const faultedMetric = extractMetricFromAggregate(invariant, faultedAggregate);

  const baselineValues = extractTrialValues(invariant, baselineTrials);
  const faultedValues = extractTrialValues(invariant, faultedTrials);

  const evidence: VerdictEvidence = {
    metric: invariant.metric,
    scope: invariant.scope,
    comparator: invariant.comparator,
    threshold: invariant.threshold,
    baselineAggregate: baselineMetric,
    faultedAggregate: faultedMetric,
    baselineValues,
    faultedValues,
  };

  // 1. Check baseline validity
  if (baselineAggregate.validTrialsCount === 0) {
    return {
      invariantId: invariant.id,
      status: 'INVALID',
      reason: 'Zero valid trials were completed for the baseline condition',
      evidence,
    };
  }

  if (baselineMetric === null || baselineMetric.median === null) {
    return {
      invariantId: invariant.id,
      status: 'INVALID',
      reason: 'Baseline metric could not be evaluated',
      evidence,
    };
  }

  // The baseline-must-be-healthy rule: if baseline already violates invariant -> INVALID
  const baselinePasses = checkCondition(
    baselineMetric.median,
    invariant.comparator,
    invariant.threshold,
  );
  if (!baselinePasses) {
    return {
      invariantId: invariant.id,
      status: 'INVALID',
      reason: `Baseline already violates invariant: median (${String(baselineMetric.median)}) does not satisfy ${invariant.comparator} ${String(invariant.threshold)}`,
      evidence,
    };
  }

  // 2. Check faulted condition validity
  if (faultedAggregate.validTrialsCount === 0) {
    return {
      invariantId: invariant.id,
      status: 'INVALID',
      reason: 'Zero valid trials were completed for the faulted condition',
      evidence,
    };
  }

  if (
    faultedMetric === null ||
    faultedMetric.median === null ||
    faultedMetric.p25 === null ||
    faultedMetric.p75 === null
  ) {
    return {
      invariantId: invariant.id,
      status: 'INVALID',
      reason: 'Faulted metric could not be evaluated',
      evidence,
    };
  }

  const { median, p25, p75 } = faultedMetric;
  const T = invariant.threshold;
  const comp = invariant.comparator;

  // 3. Evaluate verdict with interquartile range (IQR) check
  let status: VerdictStatus;
  let reason: string | null = null;

  if (comp === 'lte') {
    if (median <= T && p75 <= T) {
      status = 'PASS';
    } else if (median > T && p25 > T) {
      status = 'VIOLATED';
    } else {
      status = 'INCONCLUSIVE';
      reason = `Interquartile range [${String(p25)}, ${String(p75)}] straddles threshold ${String(T)}`;
    }
  } else if (comp === 'lt') {
    if (median < T && p75 < T) {
      status = 'PASS';
    } else if (median >= T && p25 >= T) {
      status = 'VIOLATED';
    } else {
      status = 'INCONCLUSIVE';
      reason = `Interquartile range [${String(p25)}, ${String(p75)}] straddles threshold ${String(T)}`;
    }
  } else if (comp === 'gte') {
    if (median >= T && p25 >= T) {
      status = 'PASS';
    } else if (median < T && p75 < T) {
      status = 'VIOLATED';
    } else {
      status = 'INCONCLUSIVE';
      reason = `Interquartile range [${String(p25)}, ${String(p75)}] straddles threshold ${String(T)}`;
    }
  } else {
    // gt
    if (median > T && p25 > T) {
      status = 'PASS';
    } else if (median <= T && p75 <= T) {
      status = 'VIOLATED';
    } else {
      status = 'INCONCLUSIVE';
      reason = `Interquartile range [${String(p25)}, ${String(p75)}] straddles threshold ${String(T)}`;
    }
  }

  return {
    invariantId: invariant.id,
    status,
    reason,
    evidence,
  };
}

export function computeOverallStatus(verdicts: readonly InvariantVerdict[]): VerdictStatus {
  if (verdicts.length === 0) return 'PASS';

  if (verdicts.some((v) => v.status === 'INVALID')) {
    return 'INVALID';
  }
  if (verdicts.some((v) => v.status === 'VIOLATED')) {
    return 'VIOLATED';
  }
  if (verdicts.some((v) => v.status === 'INCONCLUSIVE')) {
    return 'INCONCLUSIVE';
  }
  return 'PASS';
}
