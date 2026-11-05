/**
 * Closed-form Jackson Open Queueing Network & Blast Radius Solver.
 * Implements pure stochastic M/M/c queueing theory, traffic flow conservation,
 * bottleneck identification, and cascading failure propagation.
 */

export interface QueueNodeInput {
  readonly id: string;
  readonly serviceTimeMs: number;
  readonly maxWorkers: number;
  readonly maxQueueDepth?: number | undefined;
  readonly externalArrivalRps?: number | undefined;
}

export interface QueueEdgeInput {
  readonly source: string;
  readonly target: string;
  readonly weight?: number | undefined;
}

export interface NodeMetrics {
  readonly id: string;
  readonly arrivalRateRps: number;
  readonly serviceRateRps: number;
  readonly capacityRps: number;
  readonly utilization: number;
  readonly queueWaitMs: number;
  readonly meanServiceMs: number;
  readonly residenceTimeMs: number;
  readonly p50LatencyMs: number;
  readonly p99LatencyMs: number;
  readonly isSaturated: boolean;
  readonly dropRateRps: number;
}

export interface NetworkSimulationResult {
  readonly nodes: readonly NodeMetrics[];
  readonly bottleneckNodeId: string;
  readonly maxUtilization: number;
  readonly endToEndP50Ms: number;
  readonly endToEndP99Ms: number;
  readonly systemThroughputRps: number;
  readonly criticalPath: readonly string[];
}

export interface BlastRadiusResult {
  readonly targetId: string;
  readonly directDownstream: readonly string[];
  readonly transitiveDownstream: readonly string[];
  readonly impactedNodes: readonly string[];
  readonly impactedCount: number;
  readonly totalNodes: number;
  readonly blastRadiusPct: number;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
}

function factorial(n: number): number {
  let res = 1;
  for (let i = 2; i <= n; i++) {
    res *= i;
  }
  return res;
}

/**
 * Erlang-C formula for M/M/c multi-server queue
 * Calculates the probability of an arriving customer having to wait in queue.
 */
function erlangC(c: number, a: number, rho: number): number {
  if (rho >= 1.0) return 1.0;
  if (c <= 1) return rho;

  let sum = 0;
  for (let k = 0; k < c; k++) {
    sum += Math.pow(a, k) / factorial(k);
  }
  const lastTerm = Math.pow(a, c) / (factorial(c) * (1 - rho));
  const p0 = 1 / (sum + lastTerm);
  return lastTerm * p0;
}

/**
 * Solve traffic equations: lambda_i = gamma_i + sum_j(lambda_j * P_ji)
 */
function solveTrafficEquations(
  nodeIds: readonly string[],
  gammaMap: ReadonlyMap<string, number>,
  routingMatrix: ReadonlyMap<string, ReadonlyMap<string, number>>,
): Map<string, number> {
  const lambdas = new Map<string, number>();

  // Initial estimate
  for (const id of nodeIds) {
    lambdas.set(id, gammaMap.get(id) ?? 0);
  }

  // Iterative relaxation (converges rapidly for open acyclic or stable cyclic networks)
  const maxIterations = 50;
  const epsilon = 1e-4;

  for (let iter = 0; iter < maxIterations; iter++) {
    let maxDelta = 0;
    for (const i of nodeIds) {
      const ext = gammaMap.get(i) ?? 0;
      let internalFlow = 0;
      for (const j of nodeIds) {
        const pji = routingMatrix.get(j)?.get(i) ?? 0;
        if (pji > 0) {
          internalFlow += (lambdas.get(j) ?? 0) * pji;
        }
      }
      const newLambda = ext + internalFlow;
      const delta = Math.abs(newLambda - (lambdas.get(i) ?? 0));
      if (delta > maxDelta) {
        maxDelta = delta;
      }
      lambdas.set(i, newLambda);
    }
    if (maxDelta < epsilon) {
      break;
    }
  }

  return lambdas;
}

/**
 * Solve queueing metrics for an arbitrary network of services and queues.
 */
export function solveJacksonNetwork(
  nodes: readonly QueueNodeInput[],
  edges: readonly QueueEdgeInput[],
  defaultEntryArrivalRps = 50,
): NetworkSimulationResult {
  if (nodes.length === 0) {
    return {
      nodes: [],
      bottleneckNodeId: '',
      maxUtilization: 0,
      endToEndP50Ms: 0,
      endToEndP99Ms: 0,
      systemThroughputRps: 0,
      criticalPath: [],
    };
  }

  const nodeIds = nodes.map((n) => n.id);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Build routing matrix P_ij
  const outgoingWeights = new Map<string, Map<string, number>>();
  for (const id of nodeIds) {
    outgoingWeights.set(id, new Map());
  }

  for (const edge of edges) {
    if (nodeMap.has(edge.source) && nodeMap.has(edge.target)) {
      const srcMap = outgoingWeights.get(edge.source);
      if (srcMap) {
        const weight = edge.weight ?? 1.0;
        srcMap.set(edge.target, (srcMap.get(edge.target) ?? 0) + weight);
      }
    }
  }

  const routingMatrix = new Map<string, Map<string, number>>();
  for (const [src, targets] of outgoingWeights.entries()) {
    const totalWeight = Array.from(targets.values()).reduce((a, b) => a + b, 0);
    const probMap = new Map<string, number>();
    for (const [tgt, w] of targets.entries()) {
      probMap.set(tgt, totalWeight > 0 ? w / totalWeight : 0);
    }
    routingMatrix.set(src, probMap);
  }

  // External arrivals gamma_i
  const inDegree = new Map<string, number>();
  for (const id of nodeIds) inDegree.set(id, 0);
  for (const edge of edges) {
    if (inDegree.has(edge.target)) {
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
  }

  const gammaMap = new Map<string, number>();
  for (const node of nodes) {
    if (node.externalArrivalRps !== undefined && node.externalArrivalRps > 0) {
      gammaMap.set(node.id, node.externalArrivalRps);
    } else if ((inDegree.get(node.id) ?? 0) === 0) {
      // Ingress root receives external traffic
      gammaMap.set(node.id, defaultEntryArrivalRps);
    } else {
      gammaMap.set(node.id, 0);
    }
  }

  // If entire graph is cyclic with no in-degree 0, feed traffic to the first node
  const totalGamma = Array.from(gammaMap.values()).reduce((a, b) => a + b, 0);
  if (totalGamma === 0 && nodes[0]) {
    gammaMap.set(nodes[0].id, defaultEntryArrivalRps);
  }

  // Solve arrival rates
  const lambdas = solveTrafficEquations(nodeIds, gammaMap, routingMatrix);

  // Compute node performance metrics
  const nodeMetrics: NodeMetrics[] = [];
  let bottleneckNodeId = nodeIds[0];
  let maxUtilization = 0;

  for (const node of nodes) {
    const lambda = lambdas.get(node.id) ?? 0;
    const meanServiceMs = Math.max(0.5, node.serviceTimeMs);
    const singleWorkerRate = 1000 / meanServiceMs; // mu
    const workers = Math.max(1, node.maxWorkers); // c
    const capacityRps = workers * singleWorkerRate; // c * mu

    const a = lambda / singleWorkerRate; // offered load
    const rho = capacityRps > 0 ? lambda / capacityRps : 1.0;

    let queueWaitMs: number;
    let residenceTimeMs: number;
    let p50LatencyMs: number;
    let p99LatencyMs: number;
    let isSaturated: boolean;
    let dropRateRps: number;

    if (rho >= 1.0) {
      isSaturated = true;
      dropRateRps = Math.max(0, lambda - capacityRps);
      const queueDepth = node.maxQueueDepth ?? 50;
      queueWaitMs = Math.min(4500, (queueDepth / capacityRps) * 1000);
      residenceTimeMs = meanServiceMs + queueWaitMs;
      p50LatencyMs = residenceTimeMs;
      p99LatencyMs = Math.min(5000, residenceTimeMs * 1.5);
    } else {
      const pq = erlangC(workers, a, rho);
      const denominator = workers * singleWorkerRate - lambda;
      queueWaitMs = denominator > 0.001 ? (pq / denominator) * 1000 : 0;
      isSaturated = false;
      dropRateRps = 0;
      residenceTimeMs = meanServiceMs + queueWaitMs;
      p50LatencyMs = meanServiceMs + Math.max(0, queueWaitMs * Math.LN2);
      p99LatencyMs = meanServiceMs + Math.max(0, queueWaitMs * 4.605); // ln(100) ~ 4.605
    }

    if (rho > maxUtilization) {
      maxUtilization = rho;
      bottleneckNodeId = node.id;
    }

    nodeMetrics.push({
      id: node.id,
      arrivalRateRps: Number(lambda.toFixed(2)),
      serviceRateRps: Number(singleWorkerRate.toFixed(2)),
      capacityRps: Number(capacityRps.toFixed(2)),
      utilization: Number(rho.toFixed(4)),
      queueWaitMs: Number(queueWaitMs.toFixed(2)),
      meanServiceMs: Number(meanServiceMs.toFixed(2)),
      residenceTimeMs: Number(residenceTimeMs.toFixed(2)),
      p50LatencyMs: Number(p50LatencyMs.toFixed(2)),
      p99LatencyMs: Number(p99LatencyMs.toFixed(2)),
      isSaturated,
      dropRateRps: Number(dropRateRps.toFixed(2)),
    });
  }

  // Critical path search (longest latency route from roots to leaves)
  const nodeMetricMap = new Map(nodeMetrics.map((m) => [m.id, m]));
  const criticalPath = findCriticalPath(nodeIds, edges, nodeMetricMap);

  // End-to-end latencies along critical path
  let endToEndP50Ms = 0;
  let endToEndP99Ms = 0;
  for (const stepId of criticalPath) {
    const m = nodeMetricMap.get(stepId);
    if (m) {
      endToEndP50Ms += m.p50LatencyMs;
      endToEndP99Ms += m.p99LatencyMs;
    }
  }

  const systemThroughputRps = nodeMetrics.reduce(
    (acc, m) => (m.isSaturated ? acc : acc + m.arrivalRateRps),
    0,
  );

  return {
    nodes: nodeMetrics,
    bottleneckNodeId: bottleneckNodeId ?? nodeIds[0] ?? '',
    maxUtilization: Number(maxUtilization.toFixed(4)),
    endToEndP50Ms: Number(endToEndP50Ms.toFixed(2)),
    endToEndP99Ms: Number(endToEndP99Ms.toFixed(2)),
    systemThroughputRps: Number(systemThroughputRps.toFixed(2)),
    criticalPath,
  };
}

/**
 * Identify the critical path through the DAG
 */
function findCriticalPath(
  nodeIds: readonly string[],
  edges: readonly QueueEdgeInput[],
  metricMap: ReadonlyMap<string, NodeMetrics>,
): readonly string[] {
  const firstId = nodeIds[0];
  if (!firstId) return [];

  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const id of nodeIds) {
    adj.set(id, []);
    inDegree.set(id, 0);
  }

  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  // Find roots (in-degree 0)
  const roots = nodeIds.filter((id) => (inDegree.get(id) ?? 0) === 0);
  const startNodes: string[] = roots.length > 0 ? roots : [firstId];

  let longestPath: string[] = [];
  let maxPathLatency = -1;

  function dfs(curr: string, path: string[], currentLatency: number, visited: Set<string>): void {
    const latency = currentLatency + (metricMap.get(curr)?.p99LatencyMs ?? 0);
    const children = (adj.get(curr) ?? []).filter((ch) => !visited.has(ch));

    if (children.length === 0) {
      if (latency > maxPathLatency) {
        maxPathLatency = latency;
        longestPath = [...path, curr];
      }
      return;
    }

    for (const child of children) {
      visited.add(child);
      dfs(child, [...path, curr], latency, visited);
      visited.delete(child);
    }
  }

  for (const root of startNodes) {
    const visited = new Set<string>([root]);
    dfs(root, [], 0, visited);
  }

  return longestPath.length > 0 ? longestPath : [firstId];
}

/**
 * Calculate blast radius and cascading failure blast perimeter
 */
export function calculateBlastRadius(
  targetId: string,
  nodes: readonly { readonly id: string }[],
  edges: readonly { readonly source: string; readonly target: string }[],
): BlastRadiusResult {
  const totalNodes = nodes.length;
  if (totalNodes === 0) {
    return {
      targetId,
      directDownstream: [],
      transitiveDownstream: [],
      impactedNodes: [],
      impactedCount: 0,
      totalNodes: 0,
      blastRadiusPct: 0,
      severity: 'low',
    };
  }

  // Forward adjacency (downstream)
  const forwardAdj = new Map<string, string[]>();
  // Reverse adjacency (upstream callers)
  const reverseAdj = new Map<string, string[]>();

  for (const n of nodes) {
    forwardAdj.set(n.id, []);
    reverseAdj.set(n.id, []);
  }

  for (const e of edges) {
    forwardAdj.get(e.source)?.push(e.target);
    reverseAdj.get(e.target)?.push(e.source);
  }

  const directDownstream = forwardAdj.get(targetId) ?? [];

  // Transitive downstream traversal
  const transitiveSet = new Set<string>();
  const forwardQueue = [...directDownstream];
  while (forwardQueue.length > 0) {
    const curr = forwardQueue.shift();
    if (!curr) break;
    if (!transitiveSet.has(curr) && curr !== targetId) {
      transitiveSet.add(curr);
      for (const next of forwardAdj.get(curr) ?? []) {
        if (!transitiveSet.has(next)) {
          forwardQueue.push(next);
        }
      }
    }
  }

  // Upstream callers impacted by synchronous failure
  const upstreamSet = new Set<string>();
  const reverseQueue = [...(reverseAdj.get(targetId) ?? [])];
  while (reverseQueue.length > 0) {
    const curr = reverseQueue.shift();
    if (!curr) break;
    if (!upstreamSet.has(curr) && curr !== targetId) {
      upstreamSet.add(curr);
      for (const parent of reverseAdj.get(curr) ?? []) {
        if (!upstreamSet.has(parent)) {
          reverseQueue.push(parent);
        }
      }
    }
  }

  const impactedSet = new Set<string>([targetId, ...transitiveSet, ...upstreamSet]);
  const impactedNodes = Array.from(impactedSet);
  const impactedCount = impactedNodes.length;
  const blastRadiusPct = Number(((impactedCount / totalNodes) * 100).toFixed(1));

  let severity: BlastRadiusResult['severity'] = 'low';
  if (blastRadiusPct >= 75) {
    severity = 'critical';
  } else if (blastRadiusPct >= 50) {
    severity = 'high';
  } else if (blastRadiusPct >= 25) {
    severity = 'medium';
  }

  return {
    targetId,
    directDownstream,
    transitiveDownstream: Array.from(transitiveSet),
    impactedNodes,
    impactedCount,
    totalNodes,
    blastRadiusPct,
    severity,
  };
}
