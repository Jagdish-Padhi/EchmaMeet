import type {
  InvariantVerdict,
  RepairIterationRecord,
  Topology,
  TradeOffReport,
} from '@chaosboard/contracts';

/**
 * Builds a TradeOffReport when no patch satisfies all invariants within the catalog.
 * Follows section 6.9.
 */
export function buildTradeOffReport(
  bestTopology: Topology,
  latestVerdicts: readonly InvariantVerdict[],
  iterations: readonly RepairIterationRecord[],
): TradeOffReport {
  const satisfied = latestVerdicts.filter((v) => v.status === 'PASS');
  const unsatisfied = latestVerdicts.filter((v) => v.status !== 'PASS');

  const reasons: string[] = [];
  const recommendations: string[] = [];

  for (const v of unsatisfied) {
    const { metric } = v.evidence;
    if (metric === 'completion_rate') {
      reasons.push(
        'Critical synchronous dependency failure prevents 100% completion rate without an asynchronous fallback or stale-cache layer.',
      );
      recommendations.push(
        'Add a cache node before the degraded dependency to serve stale content during downstream outages.',
      );
      recommendations.push(
        'Convert the synchronous dependency edge to an asynchronous queue consumer if real-time response is not required.',
      );
    } else if (metric === 'e2e_p99_ms') {
      reasons.push(
        `Downstream latency exceeds SLA threshold (${String(v.evidence.threshold)}ms) under the current synchronous call chain.`,
      );
      recommendations.push(
        'Configure a circuit breaker with aggressive cooldown to fail fast under high downstream latency.',
      );
    } else if (metric === 'retry_amplification') {
      reasons.push('Retry amplification on degraded edge exceeds safety limit.');
      recommendations.push(
        'Enforce exponential backoff and cap maxAttempts at 2 or 3 with full jitter.',
      );
    } else {
      reasons.push(
        `Invariant "${v.invariantId}" (${metric}) could not be resolved within policy catalog bounds.`,
      );
    }
  }

  const bottleneckReason =
    reasons.length > 0
      ? reasons.join(' ')
      : 'Multiple competing constraints could not be simultaneously satisfied within policy bounds.';

  if (recommendations.length === 0) {
    recommendations.push(
      'Review system invariants and consider relaxing latency or completion requirements under degraded conditions.',
    );
  }

  return {
    schemaVersion: 1,
    bestTopology,
    iterationsTried: iterations.length,
    satisfiedInvariants: satisfied,
    unsatisfiedInvariants: unsatisfied,
    bottleneckReason,
    humanRecommendations: [...new Set(recommendations)],
  };
}
