import { z } from 'zod';
import { edgeIdSchema, nodeIdSchema } from '../common/ids';
import { eventLoopDelaySummarySchema } from './worker-control';
import { percentileSummarySchema } from './loadgen-summary';

export const trialValiditySchema = z.strictObject({
  valid: z.boolean(),
  reason: z.string().nullable(),
});
export type TrialValidity = z.infer<typeof trialValiditySchema>;

export const trialMetricsSchema = z.strictObject({
  p99LatencyMs: z.number().nonnegative().nullable(),
  p50LatencyMs: z.number().nonnegative().nullable(),
  completionRate: z.number().min(0).max(1),
  retryAmplification: z.record(edgeIdSchema, z.number().nonnegative()),
  workerSaturation: z.record(nodeIdSchema, z.number().min(0).max(1)),
  maxQueueDepth: z.record(nodeIdSchema, z.number().int().nonnegative()),
  duplicateWriteRate: z.number().nonnegative().nullable(),
  breakerOpenFraction: z.record(edgeIdSchema, z.number().min(0).max(1)),
});
export type TrialMetrics = z.infer<typeof trialMetricsSchema>;

export const trialDiagnosticsSchema = z.strictObject({
  generatorLag: percentileSummarySchema,
  generatorEventLoopDelay: eventLoopDelaySummarySchema,
  workerEventLoopDelays: z.record(nodeIdSchema, eventLoopDelaySummarySchema),
  totalScheduledRequests: z.number().int().nonnegative(),
  totalCompletedRequests: z.number().int().nonnegative(),
});
export type TrialDiagnostics = z.infer<typeof trialDiagnosticsSchema>;

export const trialResultSchema = z.strictObject({
  trialIndex: z.number().int().nonnegative(),
  seed: z.number().int(),
  validity: trialValiditySchema,
  metrics: trialMetricsSchema,
  diagnostics: trialDiagnosticsSchema,
});
export type TrialResult = z.infer<typeof trialResultSchema>;
