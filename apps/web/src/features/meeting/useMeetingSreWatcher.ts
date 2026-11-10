import { useMemo } from 'react';
import type { EdgeId, NodeId } from '@chaosboard/contracts';
import type { BoardState } from '../board';
import type { SreHazard } from './types';

/** Pure domain function evaluating distributed resilience hazards */
export function detectSreHazards(board: BoardState): SreHazard[] {
  const list: SreHazard[] = [];
  const nodeMap = new Map(board.nodes.map((n) => [n.id, n]));

  for (const edge of board.edges) {
    const targetNode = nodeMap.get(edge.target);

    // 1. Critical Retry Storm Hazard: retries >= 2 without full jitter or circuit breaker
    if (
      edge.policy.retry.maxAttempts >= 2 &&
      (edge.policy.retry.jitter === 'none' || !edge.policy.breaker.enabled)
    ) {
      list.push({
        id: `hazard-retry-storm-${edge.id}`,
        targetEdgeId: edge.id,
        title: 'Cascading Retry Storm Vulnerability',
        severity: 'critical',
        risk: `Immediate ${String(edge.policy.retry.maxAttempts)}x retries on link [${edge.source} -> ${edge.target}] without jitter or circuit breaker will trigger queue saturation and upstream cascade under downstream latency blips.`,
        recommendation:
          'Enable exponential backoff with full jitter and configure a 50% trip circuit breaker with 2s cooldown.',
        patch: {
          timeoutMs: 500,
          fallback: 'fail_fast_503',
          retry: {
            ...edge.policy.retry,
            maxAttempts: 3,
            jitter: 'full',
            backoffBaseMs: 50,
            backoffMultiplier: 2,
            maxBackoffMs: 500,
          },
          breaker: {
            enabled: true,
            failureThresholdPct: 50,
            windowRequests: 20,
            cooldownMs: 2000,
            halfOpenProbes: 2,
          },
        },
      });
    }

    // 2. Cascading Timeout Hazard
    if (edge.policy.timeoutMs === null || edge.policy.timeoutMs > 2000) {
      list.push({
        id: `hazard-timeout-${edge.id}`,
        targetEdgeId: edge.id,
        title: 'Cascading Timeout / Thread Exhaustion Risk',
        severity: 'high',
        risk: `Link [${edge.source} -> ${edge.target}] has ${edge.policy.timeoutMs === null ? 'no timeout' : `${String(edge.policy.timeoutMs)}ms timeout`}. Slow downstream responses will hold worker connections open indefinitely, starving the thread pool.`,
        recommendation: 'Enforce a strict 500ms timeout boundary with fail_fast_503 fallback.',
        patch: {
          timeoutMs: 500,
          fallback: 'fail_fast_503',
          retry: {
            ...edge.policy.retry,
            maxAttempts: edge.policy.retry.maxAttempts > 0 ? edge.policy.retry.maxAttempts : 3,
            jitter: 'full',
            backoffBaseMs: 50,
            backoffMultiplier: 2,
            maxBackoffMs: 500,
          },
          breaker: {
            enabled: true,
            failureThresholdPct: 50,
            windowRequests: 20,
            cooldownMs: 2000,
            halfOpenProbes: 2,
          },
        },
      });
    }

    // 3. Mutating Sink Protection Hazard
    if (targetNode?.kind === 'ledger_sink' && !edge.policy.breaker.enabled) {
      list.push({
        id: `hazard-sink-${edge.id}`,
        targetEdgeId: edge.id,
        title: 'Unprotected Mutating Ledger Sink',
        severity: 'critical',
        risk: `Synchronous calls directly mutating [${targetNode.label}] without a circuit breaker risk double-billing and data sink deadlock during network partitions.`,
        recommendation:
          'Activate circuit breaker with 2 half-open probe recovery and enable idempotency token header.',
        patch: {
          timeoutMs: 800,
          fallback: 'fail_fast_503',
          breaker: {
            enabled: true,
            failureThresholdPct: 40,
            windowRequests: 15,
            cooldownMs: 3000,
            halfOpenProbes: 2,
          },
          idempotency: { sendKey: true },
        },
      });
    }

    // 4. Downstream Worker Capacity Bottleneck
    const sourceNode = nodeMap.get(edge.source);
    if (
      sourceNode?.concurrency?.maxWorkers &&
      targetNode?.concurrency?.maxWorkers &&
      sourceNode.concurrency.maxWorkers >= targetNode.concurrency.maxWorkers * 3 &&
      targetNode.concurrency.maxWorkers <= 10
    ) {
      list.push({
        id: `hazard-capacity-${edge.id}`,
        targetEdgeId: edge.id,
        targetNodeId: targetNode.id,
        title: 'Downstream Worker Capacity Bottleneck',
        severity: 'high',
        risk: `Service [${sourceNode.label}] (${String(sourceNode.concurrency.maxWorkers)} workers) connects into [${targetNode.label}] (${String(targetNode.concurrency.maxWorkers)} workers). Upstream concurrency can saturate downstream queues under burst traffic.`,
        recommendation: `Scale [${targetNode.label}] workers to match caller concurrency or configure rate limiting.`,
        patch: {
          timeoutMs: 500,
          fallback: 'fail_fast_503',
          breaker: {
            enabled: true,
            failureThresholdPct: 50,
            windowRequests: 20,
            cooldownMs: 2000,
            halfOpenProbes: 2,
          },
          concurrency: { maxWorkers: Math.max(sourceNode.concurrency.maxWorkers, 20) },
        },
      });
    }
  }

  // 5. Critical Circular Synchronous Call Dependency (Cycles)
  const syncAdj = new Map<NodeId, { target: NodeId; edgeId: EdgeId }[]>();
  for (const edge of board.edges) {
    if (edge.mode === 'sync_call') {
      const existing = syncAdj.get(edge.source) ?? [];
      existing.push({ target: edge.target, edgeId: edge.id });
      syncAdj.set(edge.source, existing);
    }
  }

  const visited = new Set<NodeId>();
  const inStack = new Set<NodeId>();
  const detectedCycles: { path: NodeId[]; edgeIds: EdgeId[] }[] = [];

  function dfsCycle(curr: NodeId, path: NodeId[], edgeIds: EdgeId[]) {
    visited.add(curr);
    inStack.add(curr);
    path.push(curr);

    const neighbors = syncAdj.get(curr) ?? [];
    for (const { target, edgeId } of neighbors) {
      if (!visited.has(target)) {
        dfsCycle(target, [...path], [...edgeIds, edgeId]);
      } else if (inStack.has(target)) {
        const startIdx = path.indexOf(target);
        if (startIdx >= 0) {
          detectedCycles.push({
            path: [...path.slice(startIdx), target],
            edgeIds: [...edgeIds.slice(startIdx), edgeId],
          });
        }
      }
    }

    inStack.delete(curr);
  }

  for (const node of board.nodes) {
    if (!visited.has(node.id)) {
      dfsCycle(node.id, [], []);
    }
  }

  for (const cycle of detectedCycles) {
    const cycleLabels = cycle.path.map((nid) => nodeMap.get(nid)?.label || nid);
    const primaryEdgeId = cycle.edgeIds[cycle.edgeIds.length - 1];
    const firstNode = cycle.path[0];
    const secondNode = cycle.path[1];
    const hazard: SreHazard = {
      id: `hazard-cycle-${String(firstNode)}-${String(secondNode)}`,
      ...(primaryEdgeId !== undefined ? { targetEdgeId: primaryEdgeId } : {}),
      ...(firstNode !== undefined ? { targetNodeId: firstNode } : {}),
      title: 'Critical Circular Call Dependency',
      severity: 'critical',
      risk: `Circular synchronous RPC chain detected: [${cycleLabels.join(' -> ')}]. Cyclic sync RPCs cause distributed thread pool deadlocks and cascading timeouts under load.`,
      recommendation:
        'Break the sync call cycle by decoupling with an asynchronous event queue or isolating state.',
      patch: {
        mode: 'async_enqueue',
        breaker: {
          enabled: true,
          failureThresholdPct: 50,
          windowRequests: 20,
          cooldownMs: 3000,
          halfOpenProbes: 2,
        },
      },
    };
    list.unshift(hazard);
  }

  // 5. Unbounded Queue Saturation Hazard on Nodes
  for (const node of board.nodes) {
    if (node.queue.mode === 'unbounded') {
      list.push({
        id: `hazard-node-queue-${node.id}`,
        targetNodeId: node.id,
        title: 'Unbounded Memory Saturation Risk',
        severity: 'high',
        risk: `Service [${node.label}] is configured with an unbounded queue. Under sustained traffic surges, memory footprint will grow monotonically leading to OOM crash.`,
        recommendation:
          'Bound the queue depth to 100 requests with 429 / 503 backpressure rejection.',
        patch: {
          queue: { mode: 'bounded', maxDepth: 100 },
        },
      });
    }
  }

  return list;
}

export function useMeetingSreWatcher(board: BoardState) {
  const hazards = useMemo<SreHazard[]>(() => detectSreHazards(board), [board]);
  const primaryHazard = hazards[0] ?? null;
  const aiRaisedHand = hazards.length > 0;

  return {
    hazards,
    primaryHazard,
    aiRaisedHand,
    hazardCount: hazards.length,
  };
}
