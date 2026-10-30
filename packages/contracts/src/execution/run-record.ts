import { z } from 'zod';
import { runIdSchema } from '../common/ids';
import { topologySchema } from '../topology/topology';
import { faultSchema } from '../chaos/fault';
import { invariantSchema } from '../chaos/invariant';
import { trialConfigSchema } from './trial';
import { trialAggregateSchema } from './trial-aggregate';
import { invariantVerdictSchema, verdictStatusSchema } from './verdict';

export const runStatusSchema = z.enum(['running', 'completed', 'failed', 'cancelled']);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const provenanceSchema = z.strictObject({
  gitCommit: z.string(),
  hostDescription: z.string(),
  nodeVersion: z.string(),
  toxiproxyVersion: z.string().nullable(),
  startedAt: z.string(),
});
export type Provenance = z.infer<typeof provenanceSchema>;

export const runRecordSchema = z.strictObject({
  id: runIdSchema,
  status: runStatusSchema,
  topology: topologySchema,
  faults: z.array(faultSchema),
  invariants: z.array(invariantSchema),
  trialConfig: trialConfigSchema,
  baselineAggregate: trialAggregateSchema.nullable(),
  faultedAggregate: trialAggregateSchema.nullable(),
  verdicts: z.array(invariantVerdictSchema),
  overallStatus: verdictStatusSchema.nullable(),
  provenance: provenanceSchema,
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
});
export type RunRecord = z.infer<typeof runRecordSchema>;

export const runSummarySchema = z.strictObject({
  id: runIdSchema,
  status: runStatusSchema,
  overallStatus: verdictStatusSchema.nullable(),
  topologyId: z.string(),
  topologyName: z.string(),
  faultCount: z.number().int().nonnegative(),
  invariantCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});
export type RunSummary = z.infer<typeof runSummarySchema>;
