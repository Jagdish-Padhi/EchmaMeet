import type { RepairPatch, Topology } from '@chaosboard/contracts';

/**
 * Purely applies a validated repair patch to a topology, returning a new immutable topology.
 * Never mutates the original topology.
 */
export function applyRepairPatch(topology: Topology, patch: RepairPatch): Topology {
  // Deep clone topology
  const newNodes = topology.nodes.map((node) => ({
    ...node,
    processing: { ...node.processing },
    concurrency: { ...node.concurrency },
    queue: { ...node.queue },
  }));

  const newEdges = topology.edges.map((edge) => ({
    ...edge,
    policy: {
      ...edge.policy,
      retry: { ...edge.policy.retry },
      breaker: { ...edge.policy.breaker },
    },
  }));

  for (const op of patch.operations) {
    switch (op.op) {
      case 'set_timeout': {
        const edge = newEdges.find((e) => e.id === op.edgeId);
        if (edge) {
          edge.policy.timeoutMs = op.timeoutMs;
        }
        break;
      }

      case 'set_retry': {
        const edge = newEdges.find((e) => e.id === op.edgeId);
        if (edge) {
          edge.policy.retry = {
            maxAttempts: op.maxAttempts,
            backoffBaseMs: op.backoffBaseMs,
            backoffMultiplier: op.backoffMultiplier,
            maxBackoffMs: op.maxBackoffMs,
            jitter: op.jitter,
          };
        }
        break;
      }

      case 'set_circuit_breaker': {
        const edge = newEdges.find((e) => e.id === op.edgeId);
        if (edge) {
          edge.policy.breaker = {
            enabled: op.enabled,
            failureThresholdPct: op.failureThresholdPct,
            windowRequests: op.windowRequests,
            cooldownMs: op.cooldownMs,
            halfOpenProbes: op.halfOpenProbes,
          };
        }
        break;
      }

      case 'set_fallback': {
        const edge = newEdges.find((e) => e.id === op.edgeId);
        if (edge) {
          edge.policy.fallback = op.fallback;
        }
        break;
      }

      case 'set_edge_mode': {
        const edge = newEdges.find((e) => e.id === op.edgeId);
        if (edge) {
          edge.mode = op.mode;
        }
        break;
      }

      case 'set_concurrency': {
        const node = newNodes.find((n) => n.id === op.nodeId);
        if (node) {
          node.concurrency.maxWorkers = op.maxWorkers;
        }
        break;
      }

      case 'set_queue': {
        const node = newNodes.find((n) => n.id === op.nodeId);
        if (node) {
          node.queue =
            op.mode === 'bounded'
              ? { mode: 'bounded', maxDepth: op.maxDepth ?? 500 }
              : { mode: 'unbounded' };
        }
        break;
      }

      case 'set_rate_limit': {
        const node = newNodes.find((n) => n.id === op.nodeId);
        if (node) {
          node.ingressRateLimitRps = op.ingressRateLimitRps;
        }
        break;
      }
    }
  }

  return {
    ...topology,
    nodes: newNodes,
    edges: newEdges,
  };
}
