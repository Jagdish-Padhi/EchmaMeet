import { z } from 'zod';
import { topologySchema } from './topology';
import { invariantVerdictSchema } from './verdict';

/**
 * Trade-off report produced when no configuration satisfies all invariants within the catalog.
 * Follows section 6.9.
 */
export const tradeOffReportSchema = z.strictObject({
  schemaVersion: z.literal(1).default(1),
  bestTopology: topologySchema,
  iterationsTried: z.number().int().nonnegative(),
  satisfiedInvariants: z.array(invariantVerdictSchema),
  unsatisfiedInvariants: z.array(invariantVerdictSchema),
  bottleneckReason: z.string().min(1),
  humanRecommendations: z.array(z.string().min(1)),
});
export type TradeOffReport = z.infer<typeof tradeOffReportSchema>;
