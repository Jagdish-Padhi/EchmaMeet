import { z } from 'zod';
import { invariantIdSchema } from './ids';
import { comparatorSchema, invariantMetricSchema, invariantScopeSchema } from './invariant';
import { metricAggregateSchema } from './trial-aggregate';

export const verdictStatusSchema = z.enum(['PASS', 'VIOLATED', 'INCONCLUSIVE', 'INVALID']);
export type VerdictStatus = z.infer<typeof verdictStatusSchema>;

export const verdictEvidenceSchema = z.strictObject({
  metric: invariantMetricSchema,
  scope: invariantScopeSchema,
  comparator: comparatorSchema,
  threshold: z.number(),
  baselineAggregate: metricAggregateSchema.nullable(),
  faultedAggregate: metricAggregateSchema.nullable(),
  baselineValues: z.array(z.number()),
  faultedValues: z.array(z.number()),
});
export type VerdictEvidence = z.infer<typeof verdictEvidenceSchema>;

export const invariantVerdictSchema = z.strictObject({
  invariantId: invariantIdSchema,
  status: verdictStatusSchema,
  reason: z.string().nullable(),
  evidence: verdictEvidenceSchema,
});
export type InvariantVerdict = z.infer<typeof invariantVerdictSchema>;

export const experimentVerdictsSchema = z.strictObject({
  overallStatus: verdictStatusSchema,
  verdicts: z.array(invariantVerdictSchema),
});
export type ExperimentVerdicts = z.infer<typeof experimentVerdictsSchema>;
