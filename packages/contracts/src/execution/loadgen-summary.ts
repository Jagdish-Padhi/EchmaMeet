import { z } from 'zod';
import { eventLoopDelaySummarySchema } from './worker-control';

export const percentileSummarySchema = z.strictObject({
  minMs: z.number().nonnegative(),
  maxMs: z.number().nonnegative(),
  meanMs: z.number().nonnegative(),
  p50Ms: z.number().nonnegative(),
  p90Ms: z.number().nonnegative(),
  p99Ms: z.number().nonnegative(),
});
export type PercentileSummary = z.infer<typeof percentileSummarySchema>;

export const loadgenSummarySchema = z.strictObject({
  totalScheduled: z.number().int().nonnegative(),
  totalSent: z.number().int().nonnegative(),
  totalCompleted: z.number().int().nonnegative(),
  totalTimeouts: z.number().int().nonnegative(),
  totalErrors: z.number().int().nonnegative(),
  actualDurationMs: z.number().nonnegative(),
  sendLag: percentileSummarySchema,
  eventLoopDelay: eventLoopDelaySummarySchema,
});
export type LoadgenSummary = z.infer<typeof loadgenSummarySchema>;
