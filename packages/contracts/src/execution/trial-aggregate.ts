import { z } from 'zod';
import { edgeIdSchema, nodeIdSchema } from '../common/ids';

export const metricAggregateSchema = z.strictObject({
  median: z.number().nullable(),
  p25: z.number().nullable(),
  p75: z.number().nullable(),
  iqr: z.number().nullable(),
});
export type MetricAggregate = z.infer<typeof metricAggregateSchema>;

export const trialAggregateSchema = z.strictObject({
  trialsCount: z.number().int().nonnegative(),
  validTrialsCount: z.number().int().nonnegative(),
  invalidTrialsCount: z.number().int().nonnegative(),
  invalidReasons: z.array(z.string()),
  metrics: z.strictObject({
    p99LatencyMs: metricAggregateSchema,
    p50LatencyMs: metricAggregateSchema,
    completionRate: metricAggregateSchema,
    retryAmplification: z.record(edgeIdSchema, metricAggregateSchema),
    workerSaturation: z.record(nodeIdSchema, metricAggregateSchema),
    maxQueueDepth: z.record(nodeIdSchema, metricAggregateSchema),
    duplicateWriteRate: metricAggregateSchema,
    breakerOpenFraction: z.record(edgeIdSchema, metricAggregateSchema),
  }),
});
export type TrialAggregate = z.infer<typeof trialAggregateSchema>;
