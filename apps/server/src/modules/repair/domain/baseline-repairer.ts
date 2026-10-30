import type {
  InvariantVerdict,
  RepairOperation,
  RepairPatch,
  Topology,
} from '@chaosboard/contracts';

/**
 * Rule-based baseline repairer.
 * Uses symptom-based heuristics to propose patches without inspecting scenario names or leaking solutions.
 */
export function proposeBaselineRepair(
  topology: Topology,
  verdicts: readonly InvariantVerdict[],
  iterationIndex: number,
): RepairPatch | null {
  const violated = verdicts.filter((v) => v.status === 'VIOLATED');
  if (violated.length === 0) {
    return null;
  }

  const operations: RepairOperation[] = [];

  for (const v of violated) {
    const { metric, scope } = v.evidence;

    // Symptom 1: Retry storm / retry amplification
    if (metric === 'retry_amplification' && scope.kind === 'edge') {
      const edge = topology.edges.find((e) => e.id === scope.edgeId);
      if (edge) {
        if (edge.policy.retry.backoffBaseMs === 0 || edge.policy.retry.jitter === 'none') {
          operations.push({
            op: 'set_retry',
            edgeId: edge.id,
            maxAttempts: 1,
            backoffBaseMs: 100,
            backoffMultiplier: 2,
            maxBackoffMs: 1000,
            jitter: 'full',
            rationale:
              'Symptom: High retry amplification. Cap retries to 1 and add backoff to prevent retry storm.',
          });
        } else if (!edge.policy.breaker.enabled) {
          operations.push({
            op: 'set_circuit_breaker',
            edgeId: edge.id,
            enabled: true,
            failureThresholdPct: 50,
            windowRequests: 10,
            cooldownMs: 3000,
            halfOpenProbes: 2,
            rationale:
              'Symptom: Persistent retry amplification despite backoff. Enable circuit breaker.',
          });
        }
      }
    }

    // Symptom 2: Queue depth or worker saturation
    if ((metric === 'queue_depth_max' || metric === 'worker_saturation') && scope.kind === 'node') {
      const node = topology.nodes.find((n) => n.id === scope.nodeId);
      if (node) {
        if (node.concurrency.maxWorkers < 50 && iterationIndex === 0) {
          operations.push({
            op: 'set_concurrency',
            nodeId: node.id,
            maxWorkers: Math.min(100, node.concurrency.maxWorkers * 2),
            rationale: 'Symptom: High queue depth or worker saturation. Scale up worker pool.',
          });
        } else if (node.ingressRateLimitRps === null) {
          operations.push({
            op: 'set_rate_limit',
            nodeId: node.id,
            ingressRateLimitRps: 20,
            rationale:
              'Symptom: Saturation persists under high arrival load. Impose ingress rate limit.',
          });
        }
      }
    }

    // Symptom 3: Latency degradation
    if (metric === 'e2e_p99_ms') {
      // Find synchronous edges with high timeouts
      for (const edge of topology.edges) {
        if (edge.policy.timeoutMs !== null && edge.policy.timeoutMs > 1000) {
          operations.push({
            op: 'set_timeout',
            edgeId: edge.id,
            timeoutMs: 800,
            rationale: 'Symptom: High e2e p99 latency. Reduce downstream timeout to fail fast.',
          });
          break;
        }
      }
    }
  }

  if (operations.length === 0) {
    return null;
  }

  return {
    schemaVersion: 1,
    hypothesis: `Rule-based heuristic patch for iteration ${String(iterationIndex + 1)} based on violated invariants.`,
    operations,
  };
}
