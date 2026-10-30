import { z } from 'zod';
import { runIdSchema } from './ids';

export const runEventTypeSchema = z.enum([
  'experiment_started',
  'sandbox_ready',
  'trial_started',
  'fault_applied',
  'trial_finished',
  'trial_invalid',
  'experiment_finished',
  'experiment_failed',
  'experiment_cancelled',
]);
export type RunEventType = z.infer<typeof runEventTypeSchema>;

export const runEventSchema = z.strictObject({
  runId: runIdSchema,
  sequence: z.number().int().nonnegative(),
  timestampMs: z.number().nonnegative(),
  type: runEventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
});
export type RunEvent = z.infer<typeof runEventSchema>;
