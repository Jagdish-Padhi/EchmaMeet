import { z } from 'zod';

export const loadgenStatusClassSchema = z.enum([
  'success_2xx',
  'client_error_4xx',
  'server_error_5xx',
  'timeout',
  'connect_error',
  'network_error',
]);
export type LoadgenStatusClass = z.infer<typeof loadgenStatusClassSchema>;

export const trialPhaseSchema = z.enum(['warmup', 'measurement', 'cooldown']);
export type TrialPhase = z.infer<typeof trialPhaseSchema>;

export const loadgenRecordSchema = z.strictObject({
  requestId: z.string(),
  phase: trialPhaseSchema,
  scheduledOffsetMs: z.number().nonnegative(),
  actualSendOffsetMs: z.number().nonnegative(),
  completedOffsetMs: z.number().nonnegative().nullable(),
  durationMs: z.number().nonnegative().nullable(),
  sendLagMs: z.number().nonnegative(),
  statusClass: loadgenStatusClassSchema,
  httpStatus: z.number().int().min(100).max(599).nullable(),
  errorClass: z.string().nullable(),
});
export type LoadgenRecord = z.infer<typeof loadgenRecordSchema>;
