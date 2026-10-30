import { z } from 'zod';
import { edgeIdSchema, nodeIdSchema } from './ids';
import { edgeModeSchema, fallbackModeSchema, jitterModeSchema } from './topology';

/**
 * Operations allowed in a repair patch.
 * Matches section 6.8 and the frozen policy catalog bounds.
 */
export const repairOperationSchema = z.discriminatedUnion('op', [
  // Edge timeout
  z.strictObject({
    op: z.literal('set_timeout'),
    edgeId: edgeIdSchema,
    timeoutMs: z.number().int().min(10).max(30_000).nullable(),
    rationale: z.string().min(1),
  }),
  // Edge retries
  z.strictObject({
    op: z.literal('set_retry'),
    edgeId: edgeIdSchema,
    maxAttempts: z.number().int().min(1).max(6),
    backoffBaseMs: z.number().int().min(0).max(2_000),
    backoffMultiplier: z.number().min(1).max(4),
    maxBackoffMs: z.number().int().min(0).max(10_000),
    jitter: jitterModeSchema,
    rationale: z.string().min(1),
  }),
  // Circuit breaker
  z.strictObject({
    op: z.literal('set_circuit_breaker'),
    edgeId: edgeIdSchema,
    enabled: z.boolean(),
    failureThresholdPct: z.number().int().min(5).max(100),
    windowRequests: z.number().int().min(5).max(200),
    cooldownMs: z.number().int().min(100).max(30_000),
    halfOpenProbes: z.number().int().min(1).max(20),
    rationale: z.string().min(1),
  }),
  // Fallback mode
  z.strictObject({
    op: z.literal('set_fallback'),
    edgeId: edgeIdSchema,
    fallback: fallbackModeSchema,
    rationale: z.string().min(1),
  }),
  // Edge mode change (e.g. switch to async enqueue for decoupled processing)
  z.strictObject({
    op: z.literal('set_edge_mode'),
    edgeId: edgeIdSchema,
    mode: edgeModeSchema,
    rationale: z.string().min(1),
  }),
  // Node concurrency
  z.strictObject({
    op: z.literal('set_concurrency'),
    nodeId: nodeIdSchema,
    maxWorkers: z.number().int().min(1).max(500),
    rationale: z.string().min(1),
  }),
  // Node queue
  z.strictObject({
    op: z.literal('set_queue'),
    nodeId: nodeIdSchema,
    mode: z.enum(['bounded', 'unbounded']),
    maxDepth: z.number().int().min(1).max(10_000).nullable(),
    rationale: z.string().min(1),
  }),
  // Node rate limit
  z.strictObject({
    op: z.literal('set_rate_limit'),
    nodeId: nodeIdSchema,
    ingressRateLimitRps: z.number().int().min(1).max(5_000).nullable(),
    rationale: z.string().min(1),
  }),
]);
export type RepairOperation = z.infer<typeof repairOperationSchema>;

export const repairPatchSchema = z.strictObject({
  schemaVersion: z.literal(1).default(1),
  operations: z.array(repairOperationSchema).min(1).max(10),
  hypothesis: z.string().min(1),
});
export type RepairPatch = z.infer<typeof repairPatchSchema>;

export const patchProblemCodeSchema = z.enum([
  'unknown_edge',
  'unknown_node',
  'out_of_bounds',
  'invalid_combination',
  'exceeds_max_operations',
  'stale_cache_without_cache',
  'async_requires_queue_consumer',
]);
export type PatchProblemCode = z.infer<typeof patchProblemCodeSchema>;

export const patchValidationProblemSchema = z.strictObject({
  code: patchProblemCodeSchema,
  targetId: z.string(),
  message: z.string(),
});
export type PatchValidationProblem = z.infer<typeof patchValidationProblemSchema>;

export const patchValidationResultSchema = z.strictObject({
  valid: z.boolean(),
  problems: z.array(patchValidationProblemSchema),
});
export type PatchValidationResult = z.infer<typeof patchValidationResultSchema>;
