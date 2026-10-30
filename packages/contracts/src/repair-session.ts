import { z } from 'zod';
import { faultSchema } from './fault';
import { invariantSchema } from './invariant';
import { topologySchema } from './topology';
import { trialConfigSchema } from './trial';
import { repairPatchSchema, patchValidationResultSchema } from './repair-patch';
import { invariantVerdictSchema, verdictStatusSchema } from './verdict';
import { tradeOffReportSchema } from './trade-off';
import { runIdSchema } from './ids';

export const repairStatusSchema = z.enum([
  'running',
  'repaired',
  'trade_off_reached',
  'limits_reached',
  'failed',
  'cancelled',
]);
export type RepairStatus = z.infer<typeof repairStatusSchema>;

export const repairProposerKindSchema = z.enum(['model', 'rule_based']);
export type RepairProposerKind = z.infer<typeof repairProposerKindSchema>;

export const startRepairRequestSchema = z.strictObject({
  topology: topologySchema,
  faults: z.array(faultSchema),
  invariants: z.array(invariantSchema),
  trialConfig: trialConfigSchema,
  proposer: repairProposerKindSchema.default('model'),
  maxIterations: z.number().int().min(1).max(10).default(5),
  timeoutMs: z.number().int().min(5000).max(600_000).default(180_000),
});
export type StartRepairRequest = z.infer<typeof startRepairRequestSchema>;

export const startRepairResponseSchema = z.strictObject({
  repairId: runIdSchema,
  status: z.literal('running'),
});
export type StartRepairResponse = z.infer<typeof startRepairResponseSchema>;

export const repairDecisionSchema = z.enum(['accept', 'rollback']);
export type RepairDecision = z.infer<typeof repairDecisionSchema>;

export const repairIterationRecordSchema = z.strictObject({
  iterationIndex: z.number().int().nonnegative(),
  summarySent: z.string(),
  rawModelOutput: z.string().nullable(),
  patch: repairPatchSchema.nullable(),
  validation: patchValidationResultSchema.nullable(),
  experimentRunId: runIdSchema.nullable(),
  verdicts: z.array(invariantVerdictSchema).nullable(),
  overallStatus: verdictStatusSchema.nullable(),
  decision: repairDecisionSchema.nullable(),
  decisionReason: z.string(),
  modelCallMetadata: z
    .strictObject({
      provider: z.string(),
      modelId: z.string(),
      promptVersion: z.string(),
      latencyMs: z.number().nonnegative(),
      tokenCounts: z
        .strictObject({
          promptTokens: z.number().int().nonnegative().optional(),
          completionTokens: z.number().int().nonnegative().optional(),
        })
        .optional(),
    })
    .nullable(),
});
export type RepairIterationRecord = z.infer<typeof repairIterationRecordSchema>;

export const repairSessionRecordSchema = z.strictObject({
  id: runIdSchema,
  status: repairStatusSchema,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  proposer: repairProposerKindSchema,
  initialTopology: topologySchema,
  bestTopology: topologySchema,
  faults: z.array(faultSchema),
  invariants: z.array(invariantSchema),
  trialConfig: trialConfigSchema,
  iterations: z.array(repairIterationRecordSchema),
  finalReport: tradeOffReportSchema.nullable(),
  errorMessage: z.string().nullable(),
});
export type RepairSessionRecord = z.infer<typeof repairSessionRecordSchema>;
