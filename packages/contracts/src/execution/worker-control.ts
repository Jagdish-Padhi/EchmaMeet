import { z } from 'zod';
import { edgeIdSchema, nodeIdSchema } from '../common/ids';
import { nodeKindSchema } from '../topology/topology';

export const workerCountersSchema = z.strictObject({
  requestsIn: z.number().int().nonnegative(),
  attemptsOut: z.record(edgeIdSchema, z.number().int().nonnegative()),
  retries: z.number().int().nonnegative(),
  timeouts: z.number().int().nonnegative(),
  errorsByClass: z.record(z.string(), z.number().int().nonnegative()),
  breakerTransitions: z.record(edgeIdSchema, z.number().int().nonnegative()),
  shedRequests: z.number().int().nonnegative(),
  ledgerDuplicates: z.number().int().nonnegative(),
});
export type WorkerCounters = z.infer<typeof workerCountersSchema>;

export const eventLoopDelaySummarySchema = z.strictObject({
  minMs: z.number().nonnegative(),
  maxMs: z.number().nonnegative(),
  meanMs: z.number().nonnegative(),
  p50Ms: z.number().nonnegative(),
  p90Ms: z.number().nonnegative(),
  p99Ms: z.number().nonnegative(),
});
export type EventLoopDelaySummary = z.infer<typeof eventLoopDelaySummarySchema>;

export const workerStatusSchema = z.strictObject({
  status: z.literal('ready'),
  nodeId: nodeIdSchema,
  kind: nodeKindSchema,
  listenPort: z.number().int().min(1024).max(65535),
  uptimeMs: z.number().nonnegative(),
  eventLoopDelay: eventLoopDelaySummarySchema,
});
export type WorkerStatus = z.infer<typeof workerStatusSchema>;

export const samplePointSchema = z.strictObject({
  timestampMs: z.number().int().nonnegative(),
  queueDepth: z.number().int().nonnegative(),
  busyWorkers: z.number().int().nonnegative(),
});
export type SamplePoint = z.infer<typeof samplePointSchema>;

export const workerSeriesSchema = z.strictObject({
  nodeId: nodeIdSchema,
  intervalMs: z.number().int().positive(),
  samples: z.array(samplePointSchema),
});
export type WorkerSeries = z.infer<typeof workerSeriesSchema>;

export const workerResetResponseSchema = z.strictObject({
  status: z.literal('ok'),
  resetAtMs: z.number().int().nonnegative(),
});
export type WorkerResetResponse = z.infer<typeof workerResetResponseSchema>;

export const workerShutdownResponseSchema = z.strictObject({
  status: z.literal('shutting_down'),
});
export type WorkerShutdownResponse = z.infer<typeof workerShutdownResponseSchema>;
