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

export type ArchitectureTier = 'tier-0' | 'tier-1' | 'tier-2';

export type ServiceProtocol = 'grpc' | 'rest' | 'graphql' | 'thrift' | 'kafka' | 'internal_bus';

export interface NodeMeta {
  readonly tier?: ArchitectureTier | undefined;
  readonly protocol?: ServiceProtocol | undefined;
  readonly ownerTeam?: string | undefined;
  readonly onCall?: string | undefined;
  readonly slaP99Ms?: number | undefined;
  readonly targetAvailability?: string | undefined;
  readonly notes?: string | undefined;
}

export type BoardNode = TopologyNode & {
  readonly position: CanvasPosition;
  readonly meta?: NodeMeta;
};

export type DrawTool = 'select' | 'marquee' | 'pen' | 'highlighter' | 'eraser';

export interface CanvasStroke {
  readonly id: string;
  readonly tool: 'pen' | 'highlighter';
  readonly color: string;
  readonly width: number;
  readonly points: readonly CanvasPosition[];
}

export type EdgePortSide = 'top' | 'right' | 'bottom' | 'left';

export interface BoardState {
  readonly id: string;
  readonly name: string;
  readonly entryNodeId: NodeId;
  readonly nodes: readonly BoardNode[];
  readonly edges: readonly TopologyEdge[];
  readonly edgeControlPoints?: Readonly<Record<string, CanvasPosition>> | undefined;
  readonly edgeSourcePorts?: Readonly<Record<string, EdgePortSide>> | undefined;
  readonly edgeTargetPorts?: Readonly<Record<string, EdgePortSide>> | undefined;
  readonly selectedNodeId: NodeId | null;
  readonly selectedNodeIds?: readonly NodeId[] | undefined;
  readonly selectedEdgeId: EdgeId | null;
  readonly strokes?: readonly CanvasStroke[] | undefined;
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
    nodes: state.nodes.map((n): TopologyNode => {
      const common = {
        id: n.id,
        label: n.label,
        processing: n.processing,
        concurrency: n.concurrency,
        queue: n.queue,
        ingressRateLimitRps: n.ingressRateLimitRps ?? null,
      };

      if (n.kind === 'cache') {
        const raw = n as unknown as { ttlMs?: number };
        return {
          ...common,
          kind: 'cache',
          ttlMs: typeof raw.ttlMs === 'number' ? raw.ttlMs : 60000,
        };
      }
      if (n.kind === 'queue_consumer') {
        const raw = n as unknown as { consumeRateRps?: number };
        return {
          ...common,
          kind: 'queue_consumer',
          consumeRateRps: typeof raw.consumeRateRps === 'number' ? raw.consumeRateRps : 50,
        };
      }
      if (n.kind === 'ledger_sink') {
        const raw = n as unknown as { dedupeByKey?: boolean };
        return {
          ...common,
          kind: 'ledger_sink',
          dedupeByKey: typeof raw.dedupeByKey === 'boolean' ? raw.dedupeByKey : true,
        };
      }
      return {
        ...common,
        kind: 'service',
      };
    }),
    edges: state.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      mode: e.mode,
      policy: e.policy,
    })),
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
      meta: {
        tier: index === 0 ? 'tier-0' : 'tier-1',
        protocol: node.kind === 'queue_consumer' ? 'kafka' : 'grpc',
        ownerTeam: 'Core Infrastructure',
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
    selectedNodeIds: [],
    selectedEdgeId: null,
    edgeControlPoints: {},
    edgeSourcePorts: {},
    edgeTargetPorts: {},
    strokes: [],
    validationProblems: [],
    isValidating: false,
    isDirty: false,
  };
}
