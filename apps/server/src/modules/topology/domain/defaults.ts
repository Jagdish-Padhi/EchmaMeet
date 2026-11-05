import {
  nodeIdSchema,
  type EdgePolicy,
  type NodeKind,
  type TopologyNode,
} from '@chaosboard/contracts';

/**
 * Textbook starting values for a freshly drawn system. They are intentionally naive: a long
 * timeout, several immediate retries, no circuit breaker, no idempotency keys. They exist so the
 * tool has something honest to break and repair, and the UI labels them as defaults.
 * They are not tuned to make any scenario fail more dramatically. See docs/DECISIONS.md.
 */
export const naiveDefaults = {
  edge: {
    timeoutMs: 5000,
    maxAttempts: 3,
    backoffBaseMs: 0,
    backoffMultiplier: 1,
    maxBackoffMs: 0,
    breakerFailureThresholdPct: 50,
    breakerWindowRequests: 20,
    breakerCooldownMs: 2000,
    breakerHalfOpenProbes: 2,
    poolMaxConnections: 50,
  },
  node: {
    processingMs: 20,
    maxWorkers: 20,
    queueMaxDepth: 500,
    cacheTtlMs: 30_000,
    consumeRateRps: 100,
  },
} as const;

export function naiveEdgePolicy(): EdgePolicy {
  const edge = naiveDefaults.edge;
  return {
    timeoutMs: edge.timeoutMs,
    retry: {
      maxAttempts: edge.maxAttempts,
      backoffBaseMs: edge.backoffBaseMs,
      backoffMultiplier: edge.backoffMultiplier,
      maxBackoffMs: edge.maxBackoffMs,
      jitter: 'none',
    },
    breaker: {
      enabled: false,
      failureThresholdPct: edge.breakerFailureThresholdPct,
      windowRequests: edge.breakerWindowRequests,
      cooldownMs: edge.breakerCooldownMs,
      halfOpenProbes: edge.breakerHalfOpenProbes,
    },
    fallback: 'fail_fast_503',
    idempotency: { sendKey: false },
    pool: { maxConnections: edge.poolMaxConnections },
  };
}

export function createNaiveNode(kind: NodeKind, id: string, label: string): TopologyNode {
  const node = naiveDefaults.node;
  const common = {
    id: nodeIdSchema.parse(id),
    label,
    processing: { distribution: 'constant', ms: node.processingMs },
    concurrency: { maxWorkers: node.maxWorkers },
    queue: { mode: 'bounded', maxDepth: node.queueMaxDepth },
    ingressRateLimitRps: null,
  } as const;

  switch (kind) {
    case 'service':
      return { ...common, kind };
    case 'cache':
      return { ...common, kind, ttlMs: node.cacheTtlMs };
    case 'queue_consumer':
      return { ...common, kind, consumeRateRps: node.consumeRateRps };
    case 'ledger_sink':
      return { ...common, kind, dedupeByKey: false };
  }
}
