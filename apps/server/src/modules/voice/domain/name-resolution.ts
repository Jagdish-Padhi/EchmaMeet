export interface TopologyNodeRef {
  readonly id: string;
  readonly label: string;
}

export interface TopologyEdgeRef {
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

export interface ResolvedEdgeMatch {
  readonly status: 'exact' | 'ambiguous' | 'none';
  readonly edge?: TopologyEdgeRef | undefined;
  readonly candidates: readonly TopologyEdgeRef[];
  readonly message?: string | undefined;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Deterministically resolves spoken node or edge references against current topology.
 * Never guesses: if multiple edges match or no edge matches, returns ambiguous or none.
 */
export function resolveEdgeFromSpokenText(
  spokenText: string,
  edges: readonly TopologyEdgeRef[],
  nodes: readonly TopologyNodeRef[],
): ResolvedEdgeMatch {
  const normSpoken = normalize(spokenText);

  // Check for direct edge ID or label matches
  const directMatches = edges.filter(
    (e) =>
      normSpoken.includes(normalize(e.id)) ||
      normSpoken.includes(`${normalize(e.source)}${normalize(e.target)}`) ||
      (normSpoken.includes(normalize(e.source)) && normSpoken.includes(normalize(e.target))),
  );

  if (directMatches.length === 1) {
    const edge = directMatches[0];
    if (edge) {
      return { status: 'exact', edge, candidates: directMatches };
    }
  }

  if (directMatches.length > 1) {
    return {
      status: 'ambiguous',
      candidates: directMatches,
      message: `Multiple edges match "${spokenText}": ${directMatches
        .map((e) => `${e.source} -> ${e.target}`)
        .join(', ')}. Please specify source and target.`,
    };
  }

  // Check if spoken text names a single node
  const mentionedNodes = nodes.filter(
    (n) => normSpoken.includes(normalize(n.id)) || normSpoken.includes(normalize(n.label)),
  );

  if (mentionedNodes.length === 1) {
    const node = mentionedNodes[0];
    if (node) {
      const adjacentEdges = edges.filter((e) => e.source === node.id || e.target === node.id);
      if (adjacentEdges.length === 1) {
        const edge = adjacentEdges[0];
        if (edge) {
          return { status: 'exact', edge, candidates: adjacentEdges };
        }
      }
      if (adjacentEdges.length > 1) {
        return {
          status: 'ambiguous',
          candidates: adjacentEdges,
          message: `Node "${node.label}" connects to ${String(adjacentEdges.length)} edges. Please specify downstream target.`,
        };
      }
    }
  }

  return {
    status: 'none',
    candidates: [],
    message: `No active edge matches "${spokenText}".`,
  };
}
