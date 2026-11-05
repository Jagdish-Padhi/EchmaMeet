import { z } from 'zod';
import { runIdSchema } from '../common/ids';
import { topologySchema } from '../topology/topology';
import { faultSchema } from '../chaos/fault';
import { invariantSchema } from '../chaos/invariant';
import { trialConfigSchema } from './trial';

export const startExperimentRequestSchema = z.strictObject({
  topology: topologySchema,
  faults: z.array(faultSchema),
  invariants: z.array(invariantSchema),
  trialConfig: trialConfigSchema,
});
export type StartExperimentRequest = z.infer<typeof startExperimentRequestSchema>;

export const startExperimentResponseSchema = z.strictObject({
  runId: runIdSchema,
});
export type StartExperimentResponse = z.infer<typeof startExperimentResponseSchema>;

export const cancelExperimentResponseSchema = z.strictObject({
  runId: runIdSchema,
  status: z.literal('cancelled'),
});
export type CancelExperimentResponse = z.infer<typeof cancelExperimentResponseSchema>;
