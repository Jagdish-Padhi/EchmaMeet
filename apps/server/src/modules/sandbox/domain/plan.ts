import {
  networkPlanSchema,
  type EdgeProxyAllocation,
  type NetworkPlan,
  type NodePortAllocation,
  type Topology,
} from '@chaosboard/contracts';
import { AppError } from '@chaosboard/shared';

export interface PlanAllocationOptions {
  readonly baseNodePort?: number | undefined;
  readonly baseProxyPort?: number | undefined;
  readonly reservedPorts?: ReadonlySet<number> | undefined;
}

const DEFAULT_BASE_NODE_PORT = 20000;
const DEFAULT_BASE_PROXY_PORT = 28000;
const MIN_PORT = 1024;
const MAX_PORT = 65535;

/**
 * Purely allocates non-conflicting network ports for all nodes and proxy ports for all edges
 * in a topology.
 */
export function allocateNetworkPlan(
  topology: Topology,
  options?: PlanAllocationOptions,
): NetworkPlan {
  const baseNodePort = options?.baseNodePort ?? DEFAULT_BASE_NODE_PORT;
  const baseProxyPort = options?.baseProxyPort ?? DEFAULT_BASE_PROXY_PORT;
  const reserved = options?.reservedPorts ?? new Set<number>();

  const usedPorts = new Set<number>(reserved);

  let currentNodePort = baseNodePort;
  const nodeAllocations: NodePortAllocation[] = [];

  for (const node of topology.nodes) {
    while (usedPorts.has(currentNodePort)) {
      currentNodePort++;
      if (currentNodePort > MAX_PORT) {
        throw new AppError(
          'validation',
          'port_range_exhausted',
          `Port range exhausted while allocating node ports for ${node.id}`,
        );
      }
    }

    if (currentNodePort < MIN_PORT || currentNodePort > MAX_PORT) {
      throw new AppError(
        'validation',
        'invalid_port',
        `Allocated node port ${String(currentNodePort)} is outside valid range [${String(MIN_PORT)}, ${String(MAX_PORT)}]`,
      );
    }

    usedPorts.add(currentNodePort);
    nodeAllocations.push({
      nodeId: node.id,
      port: currentNodePort,
    });
    currentNodePort++;
  }

  let currentProxyPort = baseProxyPort;
  const edgeAllocations: EdgeProxyAllocation[] = [];

  for (const edge of topology.edges) {
    while (usedPorts.has(currentProxyPort)) {
      currentProxyPort++;
      if (currentProxyPort > MAX_PORT) {
        throw new AppError(
          'validation',
          'port_range_exhausted',
          `Port range exhausted while allocating proxy ports for ${edge.id}`,
        );
      }
    }

    if (currentProxyPort < MIN_PORT || currentProxyPort > MAX_PORT) {
      throw new AppError(
        'validation',
        'invalid_port',
        `Allocated proxy port ${String(currentProxyPort)} is outside valid range [${String(MIN_PORT)}, ${String(MAX_PORT)}]`,
      );
    }

    usedPorts.add(currentProxyPort);
    edgeAllocations.push({
      edgeId: edge.id,
      proxyPort: currentProxyPort,
    });
    currentProxyPort++;
  }

  return networkPlanSchema.parse({
    schemaVersion: 1,
    topologyId: topology.id,
    nodes: nodeAllocations,
    edges: edgeAllocations,
  });
}
