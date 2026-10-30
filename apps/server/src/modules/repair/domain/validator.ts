import type {
  PatchValidationProblem,
  PatchValidationResult,
  RepairPatch,
  Topology,
} from '@chaosboard/contracts';

export function validateRepairPatch(
  topology: Topology,
  patch: RepairPatch,
  maxOperations = 10,
): PatchValidationResult {
  const problems: PatchValidationProblem[] = [];

  if (patch.operations.length > maxOperations) {
    problems.push({
      code: 'exceeds_max_operations',
      targetId: 'patch',
      message: `Patch has ${String(patch.operations.length)} operations, exceeding maximum allowed (${String(maxOperations)})`,
    });
  }

  const nodeMap = new Map(topology.nodes.map((n) => [n.id, n]));
  const edgeMap = new Map(topology.edges.map((e) => [e.id, e]));

  for (const op of patch.operations) {
    switch (op.op) {
      case 'set_timeout':
      case 'set_retry':
      case 'set_circuit_breaker': {
        if (!edgeMap.has(op.edgeId)) {
          problems.push({
            code: 'unknown_edge',
            targetId: op.edgeId,
            message: `Edge "${op.edgeId}" does not exist in topology.`,
          });
        }
        break;
      }

      case 'set_fallback': {
        const edge = edgeMap.get(op.edgeId);
        if (!edge) {
          problems.push({
            code: 'unknown_edge',
            targetId: op.edgeId,
            message: `Edge "${op.edgeId}" does not exist in topology.`,
          });
          break;
        }

        if (op.fallback === 'serve_stale_cache') {
          const sourceNode = nodeMap.get(edge.source);
          if (sourceNode?.kind !== 'cache') {
            problems.push({
              code: 'stale_cache_without_cache',
              targetId: op.edgeId,
              message: `Edge "${op.edgeId}" fallback mode "serve_stale_cache" requires source node to be of kind "cache".`,
            });
          }
        }
        break;
      }

      case 'set_edge_mode': {
        const edge = edgeMap.get(op.edgeId);
        if (!edge) {
          problems.push({
            code: 'unknown_edge',
            targetId: op.edgeId,
            message: `Edge "${op.edgeId}" does not exist in topology.`,
          });
          break;
        }

        if (op.mode === 'async_enqueue') {
          const targetNode = nodeMap.get(edge.target);
          if (targetNode?.kind !== 'queue_consumer') {
            problems.push({
              code: 'async_requires_queue_consumer',
              targetId: op.edgeId,
              message: `Edge "${op.edgeId}" mode "async_enqueue" requires target node "${edge.target}" to be of kind "queue_consumer".`,
            });
          }
        }
        break;
      }

      case 'set_concurrency':
      case 'set_queue':
      case 'set_rate_limit': {
        if (!nodeMap.has(op.nodeId)) {
          problems.push({
            code: 'unknown_node',
            targetId: op.nodeId,
            message: `Node "${op.nodeId}" does not exist in topology.`,
          });
        }
        break;
      }
    }
  }

  return {
    valid: problems.length === 0,
    problems,
  };
}
