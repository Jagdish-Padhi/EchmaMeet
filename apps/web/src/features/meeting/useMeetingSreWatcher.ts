import { useMemo } from 'react';
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
        risk: `Immediate ${String(edge.policy.retry.maxAttempts)}x retries on link [${edge.source} ➔ ${edge.target}] without jitter or circuit breaker will trigger queue saturation and upstream cascade under downstream latency blips.`,
        recommendation:
          'Enable exponential backoff with full jitter and configure a 50% trip circuit breaker with 2s cooldown.',
        patch: {
          retry: {
            ...edge.policy.retry,
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
        risk: `Link [${edge.source} ➔ ${edge.target}] has ${edge.policy.timeoutMs === null ? 'no timeout' : `${String(edge.policy.timeoutMs)}ms timeout`}. Slow downstream responses will hold worker connections open indefinitely, starving the thread pool.`,
        recommendation: 'Enforce a strict 500ms timeout boundary with fail_fast_503 fallback.',
        patch: {
          timeoutMs: 500,
          fallback: 'fail_fast_503',
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
  }

  // 4. Unbounded Queue Saturation Hazard on Nodes
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
