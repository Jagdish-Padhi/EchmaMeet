export interface DirectedEdge {
  readonly from: string;
  readonly to: string;
}

function adjacency(edges: readonly DirectedEdge[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = result.get(edge.from);
    if (targets === undefined) {
      result.set(edge.from, [edge.to]);
    } else {
      targets.push(edge.to);
    }
  }
  return result;
}

/**
 * Finds one directed cycle, if any, and returns it as a path whose first and last element are the
 * same node. Search order follows `nodeIds`, so the result is deterministic.
 */
export function findCycle(
  nodeIds: readonly string[],
  edges: readonly DirectedEdge[],
): string[] | null {
  const next = adjacency(edges);
  const state = new Map<string, 'visiting' | 'done'>();

  function visit(node: string, path: string[]): string[] | null {
    state.set(node, 'visiting');
    path.push(node);
    for (const target of next.get(node) ?? []) {
      const targetState = state.get(target);
      if (targetState === 'visiting') {
        return [...path.slice(path.indexOf(target)), target];
      }
      if (targetState === undefined) {
        const found = visit(target, path);
        if (found !== null) {
          return found;
        }
      }
    }
    path.pop();
    state.set(node, 'done');
    return null;
  }

  for (const node of nodeIds) {
    if (!state.has(node)) {
      const found = visit(node, []);
      if (found !== null) {
        return found;
      }
    }
  }
  return null;
}

/** All nodes reachable from `start`, including `start` itself. */
export function reachableFrom(start: string, edges: readonly DirectedEdge[]): Set<string> {
  const next = adjacency(edges);
  const seen = new Set<string>([start]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current === undefined) {
      continue;
    }
    for (const target of next.get(current) ?? []) {
      if (!seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return seen;
}
