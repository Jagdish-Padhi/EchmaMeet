import type {
  BenchmarkComparison,
  BenchmarkSuiteSummary,
  StaticPrediction,
} from '@chaosboard/contracts';

export interface AgreementMetrics {
  violationAccuracy: number;
  p99Ratio: number | null;
  errorRateDelta: number | null;
  failureModeMatched: boolean;
}

export function calculateAgreement(
  predictions: readonly StaticPrediction[],
  empiricalRun: NonNullable<BenchmarkComparison['empiricalRun']>,
  designedFailureMode: string,
): AgreementMetrics {
  if (predictions.length === 0) {
    return {
      violationAccuracy: 0,
      p99Ratio: null,
      errorRateDelta: null,
      failureModeMatched: false,
    };
  }

  // 1. Violation accuracy across all invariants
  let totalInvariantsChecked = 0;
  let correctPredictions = 0;

  for (const verdict of empiricalRun.verdicts) {
    const isEmpiricallyViolated = verdict.status === 'VIOLATED';
    // Count votes among static predictions
    let violatedVotes = 0;
    for (const pred of predictions) {
      if (pred.predictedViolations[verdict.invariantId] === true) {
        violatedVotes++;
      }
    }
    const consensusViolated = violatedVotes >= predictions.length / 2;
    if (consensusViolated === isEmpiricallyViolated) {
      correctPredictions++;
    }
    totalInvariantsChecked++;
  }

  const violationAccuracy =
    totalInvariantsChecked > 0 ? correctPredictions / totalInvariantsChecked : 1.0;

  // 2. Numeric p99 latency ratio
  const validPredictedP99s = predictions
    .map((p) => p.predictedMetrics.p99LatencyMs)
    .filter((val): val is number => typeof val === 'number' && val > 0);

  let p99Ratio: number | null = null;
  if (
    validPredictedP99s.length > 0 &&
    empiricalRun.p99LatencyMs !== null &&
    empiricalRun.p99LatencyMs > 0
  ) {
    const avgPredictedP99 =
      validPredictedP99s.reduce((a, b) => a + b, 0) / validPredictedP99s.length;
    p99Ratio = Number((avgPredictedP99 / empiricalRun.p99LatencyMs).toFixed(3));
  }

  // 3. Numeric error rate delta
  const validPredictedErrors = predictions
    .map((p) => p.predictedMetrics.errorRate)
    .filter((val): val is number => typeof val === 'number');

  let errorRateDelta: number | null = null;
  if (validPredictedErrors.length > 0 && empiricalRun.errorRate !== null) {
    const avgPredictedError =
      validPredictedErrors.reduce((a, b) => a + b, 0) / validPredictedErrors.length;
    errorRateDelta = Number(Math.abs(avgPredictedError - empiricalRun.errorRate).toFixed(4));
  }

  // 4. Failure mode matching
  const designedTokens = tokenize(designedFailureMode);
  let failureModeMatched = false;

  for (const pred of predictions) {
    const predTokens = tokenize(pred.predictedFailureMode);
    if (predTokens.size === 0 || designedTokens.size === 0) {
      continue;
    }
    let intersectionCount = 0;
    for (const token of predTokens) {
      if (designedTokens.has(token)) {
        intersectionCount++;
      }
    }
    // At least 2 key tokens overlap or >30% token overlap
    const overlapRatio = intersectionCount / Math.min(designedTokens.size, predTokens.size);
    if (intersectionCount >= 2 || overlapRatio >= 0.3) {
      failureModeMatched = true;
      break;
    }
  }

  return {
    violationAccuracy: Number(violationAccuracy.toFixed(3)),
    p99Ratio,
    errorRateDelta,
    failureModeMatched,
  };
}

function tokenize(text: string): Set<string> {
  const stopWords = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'by',
    'for',
    'from',
    'has',
    'he',
    'in',
    'is',
    'it',
    'its',
    'of',
    'on',
    'that',
    'the',
    'to',
    'was',
    'were',
    'will',
    'with',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  return new Set(words);
}

export function computeSuiteSummary(
  results: readonly BenchmarkComparison[],
  metadata: {
    generatedAt: string;
    gitCommit: string;
    hostDescription: string;
    nodeVersion: string;
  },
): BenchmarkSuiteSummary {
  if (results.length === 0) {
    return {
      schemaVersion: 1,
      generatedAt: metadata.generatedAt,
      gitCommit: metadata.gitCommit,
      hostDescription: metadata.hostDescription,
      nodeVersion: metadata.nodeVersion,
      results: [],
      aggregateMetrics: {
        staticAccuracyPct: 0,
        modelRepairSuccessPct: 0,
        ruleBasedRepairSuccessPct: 0,
        unpredictedFailuresCount: 0,
      },
    };
  }

  let totalAccuracy = 0;
  let modelRepairsAttempted = 0;
  let modelRepairsSucceeded = 0;
  let ruleRepairsAttempted = 0;
  let ruleRepairsSucceeded = 0;
  let unpredictedFailuresCount = 0;

  let evaluatedAgreementCount = 0;
  for (const comp of results) {
    if (comp.agreement) {
      totalAccuracy += comp.agreement.violationAccuracy;
      evaluatedAgreementCount++;
    }

    if (comp.empiricalRun && comp.empiricalRun.overallStatus === 'VIOLATED') {
      const anyPredictedViolation = comp.staticPredictions.some((p) =>
        Object.values(p.predictedViolations).some((v) => v),
      );
      if (!anyPredictedViolation) {
        unpredictedFailuresCount++;
      }
    }

    if (comp.repairComparisons?.model) {
      modelRepairsAttempted++;
      if (comp.repairComparisons.model.status === 'repaired') {
        modelRepairsSucceeded++;
      }
    }

    if (comp.repairComparisons?.ruleBased) {
      ruleRepairsAttempted++;
      if (comp.repairComparisons.ruleBased.status === 'repaired') {
        ruleRepairsSucceeded++;
      }
    }
  }

  const staticAccuracyPct =
    evaluatedAgreementCount > 0
      ? Number(((totalAccuracy / evaluatedAgreementCount) * 100).toFixed(1))
      : 0;
  const modelRepairSuccessPct =
    modelRepairsAttempted > 0
      ? Number(((modelRepairsSucceeded / modelRepairsAttempted) * 100).toFixed(1))
      : 0;
  const ruleBasedRepairSuccessPct =
    ruleRepairsAttempted > 0
      ? Number(((ruleRepairsSucceeded / ruleRepairsAttempted) * 100).toFixed(1))
      : 0;

  return {
    schemaVersion: 1,
    generatedAt: metadata.generatedAt,
    gitCommit: metadata.gitCommit,
    hostDescription: metadata.hostDescription,
    nodeVersion: metadata.nodeVersion,
    results: [...results],
    aggregateMetrics: {
      staticAccuracyPct,
      modelRepairSuccessPct,
      ruleBasedRepairSuccessPct,
      unpredictedFailuresCount,
    },
  };
}
