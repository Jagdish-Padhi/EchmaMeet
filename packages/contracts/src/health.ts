import { z } from 'zod';

export const healthResponseSchema = z.strictObject({
  status: z.enum(['ok', 'degraded']),
  service: z.literal('chaosboard-server'),
  nodeVersion: z.string().min(1),
  checks: z.strictObject({
    database: z.enum(['ok', 'failed']),
  }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
