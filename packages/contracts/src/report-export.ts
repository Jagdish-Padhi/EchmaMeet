import { z } from 'zod';
import { runIdSchema } from './ids';
import { topologySchema } from './topology';
import { faultSchema } from './fault';
import { invariantSchema } from './invariant';
import { trialAggregateSchema } from './trial-aggregate';
import { invariantVerdictSchema } from './verdict';
import { provenanceSchema, runStatusSchema } from './run-record';
import { repairPatchSchema } from './repair-patch';
import { repairDecisionSchema } from './repair-session';
import { tradeOffReportSchema } from './trade-off';

export const repairTimelineEntrySchema = z.object({
  iteration: z.number().int().nonnegative(),
  patch: repairPatchSchema,
  decision: repairDecisionSchema,
  metrics: trialAggregateSchema.nullable(),
});
export type RepairTimelineEntry = z.infer<typeof repairTimelineEntrySchema>;

export const reportExportSchema = z.object({
  runId: runIdSchema,
  status: runStatusSchema,
  generatedAt: z.string(),
  provenance: provenanceSchema,
  topology: topologySchema,
  faults: z.array(faultSchema),
  invariants: z.array(invariantSchema),
  baselineMetrics: trialAggregateSchema.nullable(),
  faultedMetrics: trialAggregateSchema.nullable(),
  repairedMetrics: trialAggregateSchema.nullable(),
  verdicts: z.array(invariantVerdictSchema),
  repairTimeline: z.array(repairTimelineEntrySchema),
  tradeOffReport: tradeOffReportSchema.nullable(),
  markdown: z.string(),
  diagramSvg: z.string(),
});
export type ReportExport = z.infer<typeof reportExportSchema>;

export const blueprintCardSchema = z.object({
  runId: runIdSchema,
  status: z.enum(['generated', 'fallback_to_diagram']),
  label: z.literal('illustrative_rendering'),
  mimeType: z.string(),
  content: z.string(),
  promptSummary: z.string(),
  authoritativeMetrics: z.object({
    p50Ms: z.number().optional(),
    p95Ms: z.number().optional(),
    p99Ms: z.number().optional(),
    errorRate: z.number().optional(),
  }),
  fallbackReason: z.string().optional(),
});
export type BlueprintCard = z.infer<typeof blueprintCardSchema>;
