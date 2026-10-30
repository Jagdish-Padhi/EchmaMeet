import {
  edgeIdSchema,
  nodeIdSchema,
  topologyIdSchema,
  type EdgeMode,
  type EdgePolicy,
  type NodeKind,
  type Topology,
  type TopologyEdge,
  type TopologyNode,
} from '@chaosboard/contracts';
import { createNaiveNode, naiveEdgePolicy } from '../../domain/defaults';

/** Test-only builders for small topologies. */
export function node(id: string, kind: NodeKind = 'service'): TopologyNode {
  return createNaiveNode(kind, id, id);
}

interface EdgeOptions {
  readonly id?: string;
  readonly mode?: EdgeMode;
  readonly policy?: Partial<EdgePolicy>;
}

export function edge(source: string, target: string, options: EdgeOptions = {}): TopologyEdge {
  return {
    id: edgeIdSchema.parse(options.id ?? `${source}-to-${target}`),
    source: nodeIdSchema.parse(source),
    target: nodeIdSchema.parse(target),
    mode: options.mode ?? 'sync_call',
    policy: { ...naiveEdgePolicy(), ...options.policy },
  };
}

export function topology(
  nodes: readonly TopologyNode[],
  edges: readonly TopologyEdge[],
  entry?: string,
): Topology {
  const first = nodes[0];
  return {
    schemaVersion: 1,
    id: topologyIdSchema.parse('test-topology'),
    name: 'Test topology',
    source: 'canvas',
    entry: { nodeId: nodeIdSchema.parse(entry ?? first?.id ?? 'missing') },
    nodes: [...nodes],
    edges: [...edges],
  };
}
