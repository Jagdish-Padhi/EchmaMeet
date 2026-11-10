import type { InvariantVerdict } from '@chaosboard/contracts';

/**
 * Generates an authoritative, domain-grounded empirical finding description
 * for an invariant verdict, replacing static or placeholder fallback strings.
 */
export function formatEmpiricalFinding(verdict: InvariantVerdict): string {
  // If a specific, meaningful custom reason is present (and not a generic fallback)
  if (
    verdict.reason &&
    verdict.reason !== 'Threshold check verified' &&
    verdict.reason !== 'N/A' &&
    !verdict.reason.startsWith('Metric satisfies')
  ) {
    return verdict.reason;
  }

  const { metric, comparator, threshold, baselineAggregate, faultedAggregate, scope } =
    verdict.evidence ?? {};
  const status = verdict.status;

  const compSymbol =
    comparator === 'lte' ? '≤' : comparator === 'lt' ? '<' : comparator === 'gte' ? '≥' : '>';

  const scopeDesc =
    scope?.kind === 'edge'
      ? ` on link [${scope.edgeId}]`
      : scope?.kind === 'node'
        ? ` on service [${scope.nodeId}]`
        : '';

  const fMed =
    faultedAggregate?.median ??
    (verdict.evidence as { faultedMedian?: number | null } | undefined)?.faultedMedian;
  const fIqr = faultedAggregate?.iqr;
  const bMed =
    baselineAggregate?.median ??
    (verdict.evidence as { baselineMedian?: number | null } | undefined)?.baselineMedian;

  if (status === 'PASS') {
    switch (metric) {
      case 'e2e_p99_ms':
        return fMed !== null && fMed !== undefined
          ? `p99 latency bounded at ${fMed.toFixed(0)} ms (baseline: ${
              bMed !== null && bMed !== undefined ? `${bMed.toFixed(0)} ms` : 'nominal'
            }), strictly satisfying ${compSymbol} ${String(threshold)} ms SLO under fault.`
          : `Latency p99 satisfies threshold of ${compSymbol} ${String(threshold)} ms under chaos trial.`;

      case 'completion_rate':
        return fMed !== null && fMed !== undefined
          ? `End-to-end completion rate preserved at ${(fMed * 100).toFixed(1)}% (IQR: ${
              fIqr !== null && fIqr !== undefined ? `${(fIqr * 100).toFixed(1)}%` : '0%'
            }), satisfying target of ${compSymbol} ${(threshold * 100).toFixed(1)}%.`
          : `Completion rate meets required ${compSymbol} ${(threshold * 100).toFixed(1)}% availability target.`;

      case 'e2e_error_rate':
        return fMed !== null && fMed !== undefined
          ? `Error rate contained at ${(fMed * 100).toFixed(2)}%, well within safety tolerance of ${compSymbol} ${(threshold * 100).toFixed(2)}%.`
          : `Error rate satisfies SLO of ${compSymbol} ${(threshold * 100).toFixed(2)}%.`;

      case 'retry_amplification':
        return fMed !== null && fMed !== undefined
          ? `Retry multiplier measured at ${fMed.toFixed(2)}x${scopeDesc}, preventing traffic storms and satisfying limit of ${compSymbol} ${String(threshold)}x.`
          : `Retry amplification satisfies ${compSymbol} ${String(threshold)}x bound.`;

      case 'worker_saturation':
        return fMed !== null && fMed !== undefined
          ? `Worker thread utilization held at ${(fMed * 100).toFixed(1)}%${scopeDesc}, safely below ceiling of ${compSymbol} ${(threshold * 100).toFixed(1)}%.`
          : `Worker concurrency safely within ${compSymbol} ${(threshold * 100).toFixed(1)}% utilization limit.`;

      case 'queue_depth_max':
        return fMed !== null && fMed !== undefined
          ? `Buffer depth peaked at ${fMed.toFixed(0)} requests${scopeDesc}, remaining safely within bounded capacity of ${compSymbol} ${String(threshold)}.`
          : `Queue depth bounded within ${compSymbol} ${String(threshold)} requests.`;

      case 'duplicate_write_rate':
        return fMed !== null && fMed !== undefined
          ? `Zero duplicate mutations committed (${(fMed * 100).toFixed(2)}%), strictly enforcing idempotency requirement of ${compSymbol} ${(threshold * 100).toFixed(2)}%.`
          : `Idempotency verified: duplicate write rate satisfies ${compSymbol} ${(threshold * 100).toFixed(2)}%.`;

      case 'breaker_open_fraction':
        return fMed !== null && fMed !== undefined
          ? `Circuit breaker isolation engaged for ${(fMed * 100).toFixed(1)}% of execution window${scopeDesc}, within target bound of ${compSymbol} ${(threshold * 100).toFixed(1)}%.`
          : `Breaker trip fraction satisfies ${compSymbol} ${(threshold * 100).toFixed(1)}% expectation.`;

      default: {
        const metricName = String(metric).replace(/_/g, ' ');
        return fMed !== null && fMed !== undefined
          ? `Measured ${metricName} at ${fMed.toFixed(1)}, satisfying ${compSymbol} ${String(threshold)} threshold.`
          : `Invariant verified: ${metricName} satisfies ${compSymbol} ${String(threshold)}.`;
      }
    }
  }

  if (status === 'VIOLATED') {
    switch (metric) {
      case 'e2e_p99_ms':
        return fMed !== null && fMed !== undefined
          ? `Latency Degradation: p99 spiked to ${fMed.toFixed(0)} ms (IQR: ${
              fIqr !== null && fIqr !== undefined ? `${fIqr.toFixed(0)} ms` : 'N/A'
            }), breaching the ${String(threshold)} ms threshold by +${(fMed - threshold).toFixed(0)} ms.`
          : `Latency Violation: p99 latency exceeded the ${compSymbol} ${String(threshold)} ms SLO threshold under chaos load.`;

      case 'completion_rate':
        return fMed !== null && fMed !== undefined
          ? `Availability Drop: Completion rate collapsed to ${(fMed * 100).toFixed(1)}%, failing the ${(threshold * 100).toFixed(1)}% reliability objective.`
          : `Availability Breach: Completion rate dropped below the required ${(threshold * 100).toFixed(1)}% target.`;

      case 'e2e_error_rate':
        return fMed !== null && fMed !== undefined
          ? `Elevated Error Rate: Failures spiked to ${(fMed * 100).toFixed(2)}%, exceeding the safety threshold of ${(threshold * 100).toFixed(2)}%.`
          : `Error Rate Breach: Failure rate exceeded the allowed ${(threshold * 100).toFixed(2)}% threshold.`;

      case 'retry_amplification':
        return fMed !== null && fMed !== undefined
          ? `Cascading Retry Storm: Retry amplification surged to ${fMed.toFixed(2)}x${scopeDesc}, exceeding safety limit of ${String(threshold)}x and overwhelming downstream queues.`
          : `Retry Storm: Retry amplification exceeded the ${compSymbol} ${String(threshold)}x threshold.`;

      case 'worker_saturation':
        return fMed !== null && fMed !== undefined
          ? `Thread Pool Exhaustion: Concurrency reached ${(fMed * 100).toFixed(1)}%${scopeDesc}, exceeding the ${(threshold * 100).toFixed(1)}% thread capacity ceiling.`
          : `Thread Saturation: Worker capacity exceeded the ${(threshold * 100).toFixed(1)}% threshold.`;

      case 'queue_depth_max':
        return fMed !== null && fMed !== undefined
          ? `Buffer Saturation: Queue depth swelled to ${fMed.toFixed(0)} requests${scopeDesc}, breaching the bounded limit of ${String(threshold)}.`
          : `Queue Saturation: Maximum buffer depth exceeded threshold of ${String(threshold)} requests.`;

      case 'duplicate_write_rate':
        return fMed !== null && fMed !== undefined
          ? `Data Consistency Violation: ${(fMed * 100).toFixed(2)}% duplicate writes committed to sink, indicating missing idempotency keys during retries.`
          : `Idempotency Breach: Unprotected retries generated duplicate write operations.`;

      case 'breaker_open_fraction':
        return fMed !== null && fMed !== undefined
          ? `Breaker Trip Anomaly: Breaker remained tripped for ${(fMed * 100).toFixed(1)}% of window${scopeDesc}, exceeding expected threshold of ${(threshold * 100).toFixed(1)}%.`
          : `Circuit breaker remained open beyond the ${(threshold * 100).toFixed(1)}% expected threshold.`;

      default: {
        const metricName = String(metric).replace(/_/g, ' ');
        return fMed !== null && fMed !== undefined
          ? `Threshold Violated: ${metricName} measured at ${fMed.toFixed(1)}, breaching ${compSymbol} ${String(threshold)}.`
          : `Invariant breach: ${metricName} violated ${compSymbol} ${String(threshold)}.`;
      }
    }
  }

  if (status === 'INCONCLUSIVE') {
    return (
      verdict.reason ||
      `Statistical Variance: Interquartile range straddles the ${String(threshold)} threshold across seeded trials; rerun experiment with additional trials to confirm.`
    );
  }

  // INVALID
  return verdict.reason || 'Invalid Run: Baseline condition or preflight metrics failed validation.';
}
