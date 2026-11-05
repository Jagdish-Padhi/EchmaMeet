import type { RunRecord, Topology } from '@chaosboard/contracts';

/**
 * Pure telemetry summarizer.
 * Generates a compact, factual, versioned text summary of an experiment run.
 * Contains only measured evidence, current policy configuration, and violated invariant targets.
 * Never includes leading instructions or leaks the expected fix.
 */
export function buildTelemetrySummary(topology: Topology, record: RunRecord): string {
  const lines: string[] = [];
  lines.push(`EXPERIMENT TELEMETRY SUMMARY (Run: ${record.id}, Status: ${record.status})`);
  lines.push(
    `Overall Verdict Status: ${record.verdicts.length > 0 ? (record.overallStatus ?? 'UNKNOWN') : 'NO_VERDICTS'}`,
  );
  lines.push('');

  lines.push('INVARIANT VERDICTS:');
  for (const v of record.verdicts) {
    const { metric, scope, comparator, threshold, baselineAggregate, faultedAggregate } =
      v.evidence;
    const scopeStr =
      scope.kind === 'system'
        ? 'system'
        : `${scope.kind}:${scope.kind === 'node' ? scope.nodeId : scope.edgeId}`;

    const baseMed =
      baselineAggregate?.median !== null && baselineAggregate?.median !== undefined
        ? String(baselineAggregate.median)
        : 'N/A';
    const baseIqr =
      baselineAggregate?.iqr !== null && baselineAggregate?.iqr !== undefined
        ? ` (IQR ${String(baselineAggregate.iqr)})`
        : '';
    const faultMed =
      faultedAggregate?.median !== null && faultedAggregate?.median !== undefined
        ? String(faultedAggregate.median)
        : 'N/A';
    const faultIqr =
      faultedAggregate?.iqr !== null && faultedAggregate?.iqr !== undefined
        ? ` (IQR ${String(faultedAggregate.iqr)})`
        : '';

    lines.push(
      `- [${v.status}] Invariant "${v.invariantId}": ${metric} on ${scopeStr} must be ${comparator} ${String(threshold)}. ` +
        `Baseline median: ${baseMed}${baseIqr}. Faulted median: ${faultMed}${faultIqr}.${v.reason ? ` Reason: ${v.reason}` : ''}`,
    );
  }
  lines.push('');

  lines.push('CURRENT TOPOLOGY POLICIES:');
  for (const edge of topology.edges) {
    const { policy } = edge;
    const retryStr = `retry(max=${String(policy.retry.maxAttempts)}, base=${String(policy.retry.backoffBaseMs)}ms, mult=${String(policy.retry.backoffMultiplier)}, jitter=${policy.retry.jitter})`;
    const cbStr = policy.breaker.enabled
      ? `cb(enabled, thresh=${String(policy.breaker.failureThresholdPct)}%, cooldown=${String(policy.breaker.cooldownMs)}ms)`
      : 'cb(disabled)';
    lines.push(
      `- Edge "${edge.id}" (${edge.source} -> ${edge.target}): mode=${edge.mode}, timeout=${policy.timeoutMs !== null ? `${String(policy.timeoutMs)}ms` : 'none'}, fallback=${policy.fallback}, ${retryStr}, ${cbStr}`,
    );
  }

  for (const node of topology.nodes) {
    const maxDepthStr = node.queue.mode === 'bounded' ? String(node.queue.maxDepth) : 'unbounded';
    const queueStr = `queue(${node.queue.mode}, max=${maxDepthStr})`;
    const rateStr =
      node.ingressRateLimitRps !== null
        ? `rateLimit=${String(node.ingressRateLimitRps)}rps`
        : 'noRateLimit';
    lines.push(
      `- Node "${node.id}" (${node.kind}): workers=${String(node.concurrency.maxWorkers)}, ${queueStr}, ${rateStr}`,
    );
  }

  return lines.join('\n');
}
