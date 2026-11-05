import type { InvariantVerdict, RepairDecision } from '@chaosboard/contracts';

export interface DecisionEvaluation {
  decision: RepairDecision;
  reason: string;
}

/**
 * Pure decision evaluator for repair iterations.
 * Follows the Pareto improvement rule:
 * - Accept ONLY if targeted invariants improve and no previously satisfied invariant becomes violated/invalid.
 * - Otherwise roll back to the previous best topology.
 */
export function evaluateRepairDecision(
  previousVerdicts: readonly InvariantVerdict[],
  currentVerdicts: readonly InvariantVerdict[],
): DecisionEvaluation {
  if (previousVerdicts.length === 0) {
    // Initial run
    const allPass = currentVerdicts.every((v) => v.status === 'PASS');
    return {
      decision: 'accept',
      reason: allPass
        ? 'Initial baseline run satisfied all invariants.'
        : 'Initial baseline run accepted as starting state.',
    };
  }

  const prevMap = new Map(previousVerdicts.map((v) => [v.invariantId, v]));

  // Check 1: Regression check - did any previously PASS invariant break?
  for (const curr of currentVerdicts) {
    const prev = prevMap.get(curr.invariantId);
    if (prev && prev.status === 'PASS' && curr.status !== 'PASS') {
      return {
        decision: 'rollback',
        reason: `Regression detected: Invariant "${curr.invariantId}" previously passed but is now ${curr.status}.`,
      };
    }
  }

  // Check 2: Did anything improve?
  let passCountIncrease = 0;
  let metricImprovementCount = 0;

  for (const curr of currentVerdicts) {
    const prev = prevMap.get(curr.invariantId);
    if (!prev) continue;

    if (prev.status !== 'PASS' && curr.status === 'PASS') {
      passCountIncrease += 1;
    } else if (prev.status === 'VIOLATED' && curr.status === 'VIOLATED') {
      // Check if metric moved closer to threshold
      const prevMedian = prev.evidence.faultedAggregate?.median;
      const currMedian = curr.evidence.faultedAggregate?.median;
      const comp = curr.evidence.comparator;

      if (
        prevMedian !== null &&
        prevMedian !== undefined &&
        currMedian !== null &&
        currMedian !== undefined
      ) {
        // Statistical significance guard: improvement must exceed 20% of IQR or 2% of baseline median to distinguish from noise
        const iqr = curr.evidence.faultedAggregate?.iqr ?? 0;
        const minEffect = Math.max(iqr * 0.2, Math.abs(prevMedian) * 0.02, 1e-4);

        if (comp === 'lte' || comp === 'lt') {
          if (prevMedian - currMedian >= minEffect) {
            metricImprovementCount += 1;
          }
        } else {
          if (currMedian - prevMedian >= minEffect) {
            metricImprovementCount += 1;
          }
        }
      }
    }
  }

  if (passCountIncrease > 0) {
    return {
      decision: 'accept',
      reason: `Accepted: ${String(passCountIncrease)} invariant(s) transitioned to PASS with no regressions.`,
    };
  }

  if (metricImprovementCount > 0) {
    return {
      decision: 'accept',
      reason: `Accepted: ${String(metricImprovementCount)} violated invariant(s) moved closer to threshold with no regressions.`,
    };
  }

  return {
    decision: 'rollback',
    reason:
      'Rolled back: Patch did not improve any violated invariants or reduce violation severity.',
  };
}
