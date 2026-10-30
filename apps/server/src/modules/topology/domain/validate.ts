import type { Topology, TopologyNode, TopologyProblem } from '@chaosboard/contracts';
import { findCycle, reachableFrom, type DirectedEdge } from './graph';
import { topologyProblem } from './problem';

/**
 * Semantic rules that a schema cannot express. The input has already passed the topology
 * schema, so field shapes and numeric bounds are not checked here. Problems come back in a
 * stable order (rule by rule, element by element) and every violated rule is reported, not
 * only the first one.
 */
export function findTopologyProblems(topology: Topology): TopologyProblem[] {
  const problems: TopologyProblem[] = [];

  const nodesById = new Map<string, TopologyNode>();
  for (const node of topology.nodes) {
    if (nodesById.has(node.id)) {
      problems.push(
        topologyProblem('duplicate_node_id', `Node id "${node.id}" is used more than once.`, {
          nodeId: node.id,
        }),
      );
    } else {
      nodesById.set(node.id, node);
    }
  }

  const seenEdgeIds = new Set<string>();
  for (const edge of topology.edges) {
    if (seenEdgeIds.has(edge.id)) {
      problems.push(
        topologyProblem('duplicate_edge_id', `Edge id "${edge.id}" is used more than once.`, {
          edgeId: edge.id,
        }),
      );
    }
    seenEdgeIds.add(edge.id);
  }

  const followableEdges: DirectedEdge[] = [];
  const seenPairs = new Set<string>();
  for (const edge of topology.edges) {
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);

    if (source === undefined) {
      problems.push(
        topologyProblem(
          'unknown_edge_endpoint',
          `Edge "${edge.id}" starts at "${edge.source}", which is not a node.`,
          { edgeId: edge.id, nodeId: edge.source },
        ),
      );
    }
    if (target === undefined) {
      problems.push(
        topologyProblem(
          'unknown_edge_endpoint',
          `Edge "${edge.id}" ends at "${edge.target}", which is not a node.`,
          { edgeId: edge.id, nodeId: edge.target },
        ),
      );
    }
    if (source === undefined || target === undefined) {
      continue;
    }

    if (edge.source === edge.target) {
      problems.push(
        topologyProblem(
          'self_loop',
          `Edge "${edge.id}" connects node "${edge.source}" to itself.`,
          {
            edgeId: edge.id,
            nodeId: edge.source,
          },
        ),
      );
      continue;
    }

    const pairKey = `${edge.source}\u0000${edge.target}`;
    if (seenPairs.has(pairKey)) {
      problems.push(
        topologyProblem(
          'duplicate_edge_pair',
          `Edge "${edge.id}" repeats the connection from "${edge.source}" to "${edge.target}". Only one edge per pair is allowed.`,
          { edgeId: edge.id },
        ),
      );
      continue;
    }
    seenPairs.add(pairKey);
    followableEdges.push({ from: edge.source, to: edge.target });

    if (edge.mode === 'async_enqueue' && target.kind !== 'queue_consumer') {
      problems.push(
        topologyProblem(
          'async_edge_target_not_consumer',
          `Edge "${edge.id}" enqueues asynchronously, so its target "${target.id}" must be a queue_consumer node, not "${target.kind}".`,
          { edgeId: edge.id, nodeId: target.id },
        ),
      );
    }
    if (target.kind === 'queue_consumer' && edge.mode !== 'async_enqueue') {
      problems.push(
        topologyProblem(
          'consumer_requires_async_edge',
          `Node "${target.id}" is a queue_consumer, so edge "${edge.id}" into it must use mode async_enqueue.`,
          { edgeId: edge.id, nodeId: target.id },
        ),
      );
    }
    if (source.kind === 'ledger_sink') {
      problems.push(
        topologyProblem(
          'ledger_has_outgoing_edge',
          `Node "${source.id}" is a ledger_sink and cannot call other nodes, but edge "${edge.id}" leaves it.`,
          { edgeId: edge.id, nodeId: source.id },
        ),
      );
    }
    if (edge.policy.fallback === 'serve_stale_cache' && source.kind !== 'cache') {
      problems.push(
        topologyProblem(
          'stale_fallback_requires_cache_source',
          `Edge "${edge.id}" falls back to stale cache, but its source "${source.id}" is a "${source.kind}" node, not a cache.`,
          { edgeId: edge.id, nodeId: source.id },
        ),
      );
    }
  }

  const entry = nodesById.get(topology.entry.nodeId);
  if (entry === undefined) {
    problems.push(
      topologyProblem(
        'unknown_entry_node',
        `The entry node "${topology.entry.nodeId}" is not a node of this topology.`,
        { nodeId: topology.entry.nodeId },
      ),
    );
  } else if (entry.kind === 'queue_consumer') {
    problems.push(
      topologyProblem(
        'entry_is_queue_consumer',
        `The entry node "${entry.id}" is a queue_consumer, which only receives asynchronous work and cannot take traffic directly.`,
        { nodeId: entry.id },
      ),
    );
  }

  const cycle = findCycle([...nodesById.keys()], followableEdges);
  if (cycle !== null) {
    const first = cycle[0];
    problems.push(
      topologyProblem(
        'cycle_detected',
        `The topology contains a cycle (${cycle.join(' -> ')}). Version 1 requires an acyclic graph.`,
        first === undefined ? {} : { nodeId: first },
      ),
    );
  }

  if (entry !== undefined) {
    const reachable = reachableFrom(entry.id, followableEdges);
    for (const nodeId of nodesById.keys()) {
      if (!reachable.has(nodeId)) {
        problems.push(
          topologyProblem(
            'unreachable_node',
            `Node "${nodeId}" cannot be reached from the entry node "${entry.id}".`,
            { nodeId },
          ),
        );
      }
    }
  }

  return problems;
}
