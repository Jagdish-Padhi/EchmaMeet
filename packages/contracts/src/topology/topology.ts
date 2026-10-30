import { z } from 'zod';
import { boundedInt, boundedNumber } from '../common/bounded';
import { catalog } from '../common/catalog';
import { edgeIdSchema, nodeIdSchema, topologyIdSchema } from '../common/ids';

const { node: nodeBounds, edge: edgeBounds, topology: topologyBounds } = catalog;

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------

export const processingSchema = z.discriminatedUnion('distribution', [
  z.strictObject({
    distribution: z.literal('constant'),
    ms: boundedInt(nodeBounds.processingMs),
  }),
  z.strictObject({
    distribution: z.literal('lognormal'),
    medianMs: boundedInt(nodeBounds.processingMs),
    sigma: boundedNumber(nodeBounds.lognormalSigma),
  }),
]);
export type Processing = z.infer<typeof processingSchema>;

export const queueSchema = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('bounded'), maxDepth: boundedInt(nodeBounds.queueDepth) }),
  z.strictObject({ mode: z.literal('unbounded') }),
]);
export type QueueSettings = z.infer<typeof queueSchema>;

const nodeCommonShape = {
  id: nodeIdSchema,
  label: z.string().min(1).max(topologyBounds.labelMaxLength),
  processing: processingSchema,
  concurrency: z.strictObject({ maxWorkers: boundedInt(nodeBounds.maxWorkers) }),
  queue: queueSchema,
  ingressRateLimitRps: boundedInt(nodeBounds.ingressRateLimitRps).nullable(),
};

export const nodeKindSchema = z.enum(['service', 'cache', 'queue_consumer', 'ledger_sink']);
export type NodeKind = z.infer<typeof nodeKindSchema>;

export const nodeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...nodeCommonShape, kind: z.literal('service') }),
  z.strictObject({
    ...nodeCommonShape,
    kind: z.literal('cache'),
    ttlMs: boundedInt(nodeBounds.cacheTtlMs),
  }),
  z.strictObject({
    ...nodeCommonShape,
    kind: z.literal('queue_consumer'),
    consumeRateRps: boundedInt(nodeBounds.consumeRateRps),
  }),
  z.strictObject({
    ...nodeCommonShape,
    kind: z.literal('ledger_sink'),
    dedupeByKey: z.boolean(),
  }),
]);
export type TopologyNode = z.infer<typeof nodeSchema>;

// ---------------------------------------------------------------------------
// Edge
// ---------------------------------------------------------------------------

export const jitterModeSchema = z.enum(['none', 'full', 'equal']);
export type JitterMode = z.infer<typeof jitterModeSchema>;

export const retryPolicySchema = z.strictObject({
  maxAttempts: boundedInt(edgeBounds.maxAttempts),
  backoffBaseMs: boundedInt(edgeBounds.backoffBaseMs),
  backoffMultiplier: boundedNumber(edgeBounds.backoffMultiplier),
  maxBackoffMs: boundedInt(edgeBounds.maxBackoffMs),
  jitter: jitterModeSchema,
});
export type RetryPolicy = z.infer<typeof retryPolicySchema>;

export const breakerPolicySchema = z.strictObject({
  enabled: z.boolean(),
  failureThresholdPct: boundedInt(edgeBounds.breakerFailureThresholdPct),
  windowRequests: boundedInt(edgeBounds.breakerWindowRequests),
  cooldownMs: boundedInt(edgeBounds.breakerCooldownMs),
  halfOpenProbes: boundedInt(edgeBounds.breakerHalfOpenProbes),
});
export type BreakerPolicy = z.infer<typeof breakerPolicySchema>;

export const fallbackModeSchema = z.enum([
  'fail_fast_503',
  'serve_stale_cache',
  'enqueue_for_later',
]);
export type FallbackMode = z.infer<typeof fallbackModeSchema>;

export const edgePolicySchema = z.strictObject({
  /** Explicit null means no timeout. It is never a default. */
  timeoutMs: boundedInt(edgeBounds.timeoutMs).nullable(),
  retry: retryPolicySchema,
  breaker: breakerPolicySchema,
  fallback: fallbackModeSchema,
  idempotency: z.strictObject({ sendKey: z.boolean() }),
  pool: z.strictObject({ maxConnections: boundedInt(edgeBounds.poolMaxConnections) }),
});
export type EdgePolicy = z.infer<typeof edgePolicySchema>;

export const edgeModeSchema = z.enum(['sync_call', 'async_enqueue']);
export type EdgeMode = z.infer<typeof edgeModeSchema>;

export const edgeSchema = z.strictObject({
  id: edgeIdSchema,
  source: nodeIdSchema,
  target: nodeIdSchema,
  mode: edgeModeSchema,
  policy: edgePolicySchema,
});
export type TopologyEdge = z.infer<typeof edgeSchema>;

// ---------------------------------------------------------------------------
// Topology
// ---------------------------------------------------------------------------

export const topologySourceSchema = z.enum(['canvas', 'image', 'scenario']);
export type TopologySource = z.infer<typeof topologySourceSchema>;

export const topologySchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: topologyIdSchema,
  name: z.string().min(1).max(topologyBounds.nameMaxLength),
  source: topologySourceSchema,
  entry: z.strictObject({ nodeId: nodeIdSchema }),
  nodes: z.array(nodeSchema).min(1).max(topologyBounds.maxNodes),
  edges: z.array(edgeSchema).max(topologyBounds.maxEdges),
});
export type Topology = z.infer<typeof topologySchema>;
