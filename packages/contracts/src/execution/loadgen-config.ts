import { z } from 'zod';
import { arrivalProcessSchema, type ArrivalProcess } from './trial';

export { arrivalProcessSchema };
export type { ArrivalProcess };

export const loadgenConfigSchema = z.strictObject({
  targetUrl: z.url(),
  arrivalProcess: arrivalProcessSchema,
  arrivalRateRps: z.number().positive().max(10000),
  warmupDurationMs: z.number().int().nonnegative().max(60000),
  measurementDurationMs: z.number().int().positive().max(300000),
  cooldownDurationMs: z.number().int().nonnegative().max(60000),
  clientTimeoutMs: z.number().int().positive().max(60000),
  seed: z.number().int(),
  requestIdPrefix: z.string().min(1).max(32).default('req'),
  method: z.enum(['GET', 'POST']).default('POST'),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.string().optional(),
});
export type LoadgenConfig = z.infer<typeof loadgenConfigSchema>;
