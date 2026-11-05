import { z } from 'zod';
import { edgeIdSchema, invariantIdSchema, nodeIdSchema } from '../common/ids';

export const invariantMetricSchema = z.enum([
  'e2e_p99_ms',
  'e2e_error_rate',
  'completion_rate',
  'retry_amplification',
  'worker_saturation',
  'queue_depth_max',
  'duplicate_write_rate',
  'breaker_open_fraction',
]);
export type InvariantMetric = z.infer<typeof invariantMetricSchema>;

export const invariantScopeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('system') }),
  z.strictObject({ kind: z.literal('node'), nodeId: nodeIdSchema }),
  z.strictObject({ kind: z.literal('edge'), edgeId: edgeIdSchema }),
]);
export type InvariantScope = z.infer<typeof invariantScopeSchema>;

/** The kind of scope each metric is measured at. */
export const metricScopeKind: Readonly<Record<InvariantMetric, InvariantScope['kind']>> = {
  e2e_p99_ms: 'system',
  e2e_error_rate: 'system',
  completion_rate: 'system',
  retry_amplification: 'edge',
  worker_saturation: 'node',
  queue_depth_max: 'node',
  duplicate_write_rate: 'node',
  breaker_open_fraction: 'edge',
};

export const comparatorSchema = z.enum(['lt', 'lte', 'gt', 'gte']);
export type Comparator = z.infer<typeof comparatorSchema>;

export const invariantSchema = z
  .strictObject({
    id: invariantIdSchema,
    metric: invariantMetricSchema,
    scope: invariantScopeSchema,
    comparator: comparatorSchema,
    /** Zod rejects NaN and infinite values by default. */
    threshold: z.number().nonnegative(),
  })
  .refine((invariant) => invariant.scope.kind === metricScopeKind[invariant.metric], {
    message: 'scope kind does not match the metric',
    path: ['scope'],
  });
export type Invariant = z.infer<typeof invariantSchema>;
