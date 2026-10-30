import { z } from 'zod';
import { boundedInt } from './bounded';
import { catalog } from './catalog';

const { trial: bounds } = catalog;

export const arrivalProcessSchema = z.enum(['constant', 'poisson']);
export type ArrivalProcess = z.infer<typeof arrivalProcessSchema>;

export const trialConfigSchema = z.strictObject({
  arrivalRateRps: boundedInt(bounds.arrivalRateRps),
  arrivalProcess: arrivalProcessSchema,
  warmupMs: boundedInt(bounds.warmupMs),
  measurementMs: boundedInt(bounds.measurementMs),
  cooldownMs: boundedInt(bounds.cooldownMs),
  clientTimeoutMs: boundedInt(bounds.clientTimeoutMs),
  /** Unsigned 32-bit base seed. Per-trial seeds are derived from it. */
  seed: z.number().int().min(0).max(0xffff_ffff),
  trials: boundedInt(bounds.trials),
});
export type TrialConfig = z.infer<typeof trialConfigSchema>;
