import {
  nodeConfigSchema,
  type NetworkPlan,
  type NodeConfig,
  type NodeId,
  type NodeOutgoingEdge,
  type Topology,
} from '@chaosboard/contracts';
import { AppError, deriveSeed } from '@chaosboard/shared';

export interface DeriveConfigOptions {
  readonly listenHost?: string | undefined;
  readonly useProxies?: boolean | undefined;
  readonly baseSeed?: number | undefined;
  readonly sampleIntervalMs?: number | undefined;
}

const DEFAULT_LISTEN_HOST = '127.0.0.1';
const DEFAULT_BASE_SEED = 42;
const DEFAULT_SAMPLE_INTERVAL_MS = 50;

/**
 * Purely derives node configurations for all nodes from a validated topology and network plan.
 */
export function deriveNodeConfigurations(
  topology: Topology,
  plan: NetworkPlan,
  options?: DeriveConfigOptions,
): Map<NodeId, NodeConfig> {
  const listenHost = options?.listenHost ?? DEFAULT_LISTEN_HOST;
  const useProxies = options?.useProxies ?? true;
  const baseSeed = options?.baseSeed ?? DEFAULT_BASE_SEED;
  const sampleIntervalMs = options?.sampleIntervalMs ?? DEFAULT_SAMPLE_INTERVAL_MS;

  const nodePortMap = new Map<NodeId, number>();
  for (const n of plan.nodes) {
    nodePortMap.set(n.nodeId, n.port);
  }

  const edgeProxyMap = new Map<string, number>();
  for (const e of plan.edges) {
    edgeProxyMap.set(e.edgeId, e.proxyPort);
  }

  const result = new Map<NodeId, NodeConfig>();

  for (let i = 0; i < topology.nodes.length; i++) {
    const node = topology.nodes[i];
    if (!node) {
      continue;
    }
    const port = nodePortMap.get(node.id);
    if (port === undefined) {
      throw new AppError(
        'validation',
        'missing_node_port',
        `Network plan is missing port allocation for node "${node.id}".`,
      );
    }

    const outgoingEdges: NodeOutgoingEdge[] = [];
    const nodeEdges = topology.edges.filter((e) => e.source === node.id);

    for (const edge of nodeEdges) {
      let targetUrl: string;
      if (useProxies) {
        const proxyPort = edgeProxyMap.get(edge.id);
        if (proxyPort === undefined) {
          throw new AppError(
            'validation',
            'missing_proxy_port',
            `Network plan is missing proxy port allocation for edge "${edge.id}".`,
          );
        }
        targetUrl = `http://${listenHost}:${String(proxyPort)}/request`;
      } else {
        const targetPort = nodePortMap.get(edge.target);
        if (targetPort === undefined) {
          throw new AppError(
            'validation',
            'missing_target_port',
            `Network plan is missing port allocation for target node "${edge.target}".`,
          );
        }
        targetUrl = `http://${listenHost}:${String(targetPort)}/request`;
      }

      outgoingEdges.push({
        edgeId: edge.id,
        targetNodeId: edge.target,
        targetUrl,
        mode: edge.mode,
        policy: edge.policy,
      });
    }

    const config = nodeConfigSchema.parse({
      schemaVersion: 1,
      nodeId: node.id,
      topologyId: topology.id,
      listenHost,
      listenPort: port,
      node,
      outgoingEdges,
      seed: deriveSeed(baseSeed, i),
      sampleIntervalMs,
    });

    result.set(node.id, config);
  }

  return result;
}
