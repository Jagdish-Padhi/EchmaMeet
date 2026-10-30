import type {
  EdgeId,
  NodeId,
  Topology,
  TopologyDraft,
  TopologyEdge,
  TopologyNode,
  TopologyProblem,
} from '@chaosboard/contracts';

export interface CanvasPosition {
  readonly x: number;
  readonly y: number;
}

export type BoardNode = TopologyNode & {
  readonly position: CanvasPosition;
};

export interface BoardState {
  readonly id: string;
  readonly name: string;
  readonly entryNodeId: NodeId;
  readonly nodes: readonly BoardNode[];
  readonly edges: readonly TopologyEdge[];
  readonly selectedNodeId: NodeId | null;
  readonly selectedEdgeId: EdgeId | null;
  readonly validationProblems: readonly TopologyProblem[];
  readonly isValidating: boolean;
  readonly isDirty: boolean;
}

export function toTopologyDraft(state: BoardState): TopologyDraft {
  return {
    name: state.name,
    source: 'canvas',
    entryRef: state.entryNodeId,
    nodes: state.nodes.map((n) => ({
      ref: n.id,
      label: n.label,
      kind: n.kind,
    })),
    edges: state.edges.map((e) => ({
      sourceRef: e.source,
      targetRef: e.target,
      mode: e.mode,
    })),
  };
}

export function fromTopology(topology: Topology): BoardState {
  const nodesWithPositions: BoardNode[] = topology.nodes.map((node, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    return {
      ...node,
      position: {
        x: 100 + col * 260,
        y: 100 + row * 180,
      },
    };
  });

  return {
    id: topology.id,
    name: topology.name,
    entryNodeId: topology.entry.nodeId,
    nodes: nodesWithPositions,
    edges: [...topology.edges],
    selectedNodeId: null,
    selectedEdgeId: null,
    validationProblems: [],
    isValidating: false,
    isDirty: false,
  };
}
