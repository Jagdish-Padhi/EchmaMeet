import {
  topologyIdSchema,
  type EdgeId,
  type NodeId,
  type Topology,
  type TopologyDraft,
  type TopologyEdge,
  type TopologyId,
  type TopologyNode,
  type TopologyProblem,
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

export function toTopology(state: BoardState): Topology {
  const fallbackId = 'canvas-topology' as TopologyId;
  const topologyId =
    state.id && topologyIdSchema.safeParse(state.id).success
      ? (state.id as TopologyId)
      : fallbackId;

  const entryNodeId =
    state.entryNodeId || (state.nodes[0]?.id ? state.nodes[0].id : ('entry' as NodeId));

  return {
    schemaVersion: 1,
    id: topologyId,
    name: state.name || 'Canvas Architecture',
    source: 'canvas',
    entry: { nodeId: entryNodeId },
    nodes: state.nodes.map((n) => {
      const nodeProps = { ...n };
      delete (nodeProps as { position?: unknown }).position;
      return {
        ...nodeProps,
        ingressRateLimitRps: nodeProps.ingressRateLimitRps ?? null,
      };
    }),
    edges: [...state.edges],
  };
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
