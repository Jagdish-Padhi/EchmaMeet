import { z } from 'zod';
import { runIdSchema, scenarioIdSchema } from '../common/ids';
import { invariantVerdictSchema, verdictStatusSchema } from '../execution/verdict';

export const staticPredictionSchema = z.strictObject({
  scenarioId: scenarioIdSchema,
  predictionIndex: z.number().int().min(0),
  modelId: z.string().min(1),
  promptVersion: z.string().min(1),
  predictedViolations: z.record(z.string(), z.boolean()),
  predictedMetrics: z.strictObject({
    p99LatencyMs: z.number().min(0).nullable(),
    errorRate: z.number().min(0).max(1).nullable(),
  }),
  predictedFailureMode: z.string().min(1),
  rationale: z.string().min(1),
  timestamp: z.string(),
});
export type StaticPrediction = z.infer<typeof staticPredictionSchema>;

export const repairOutcomeSummarySchema = z.strictObject({
  status: z.enum(['repaired', 'trade_off_reached', 'limits_reached', 'failed']),
  iterationsCount: z.number().int().min(0),
  patchCount: z.number().int().min(0),
  totalTokens: z
    .strictObject({
      promptTokens: z.number().int().min(0),
      completionTokens: z.number().int().min(0),
    })
    .optional(),
});
export type RepairOutcomeSummary = z.infer<typeof repairOutcomeSummarySchema>;

export const benchmarkComparisonSchema = z.strictObject({
  scenarioId: scenarioIdSchema,
  designedFailureMode: z.string().min(1),
  staticPredictions: z.array(staticPredictionSchema),
  empiricalRun: z
    .strictObject({
      runId: runIdSchema,
      verdicts: z.array(invariantVerdictSchema),
      overallStatus: verdictStatusSchema,
      p99LatencyMs: z.number().min(0).nullable(),
      errorRate: z.number().min(0).max(1).nullable(),
    })
    .optional(),
  repairComparisons: z
    .strictObject({
      ruleBased: repairOutcomeSummarySchema.optional(),
      model: repairOutcomeSummarySchema.optional(),
    })
    .optional(),
  agreement: z
    .strictObject({
      violationAccuracy: z.number().min(0).max(1),
      p99Ratio: z.number().nullable(),
      errorRateDelta: z.number().nullable(),
      failureModeMatched: z.boolean(),
    })
    .optional(),
});
export type BenchmarkComparison = z.infer<typeof benchmarkComparisonSchema>;

export const benchmarkSuiteSummarySchema = z.strictObject({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  gitCommit: z.string(),
  hostDescription: z.string(),
  nodeVersion: z.string(),
  results: z.array(benchmarkComparisonSchema),
  aggregateMetrics: z.strictObject({
    staticAccuracyPct: z.number().min(0).max(100),
    modelRepairSuccessPct: z.number().min(0).max(100),
    ruleBasedRepairSuccessPct: z.number().min(0).max(100),
    unpredictedFailuresCount: z.number().int().min(0),
  }),
});
export type BenchmarkSuiteSummary = z.infer<typeof benchmarkSuiteSummarySchema>;
