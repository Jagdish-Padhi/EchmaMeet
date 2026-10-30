import { describe, expect, it } from 'vitest';
import { catalog } from './catalog';
import { trialConfigSchema } from './trial';

const valid = {
  arrivalRateRps: 100,
  arrivalProcess: 'poisson',
  warmupMs: 2000,
  measurementMs: 6000,
  cooldownMs: 500,
  clientTimeoutMs: 5000,
  seed: 12345,
  trials: 5,
};

describe('trialConfigSchema', () => {
  it('accepts a valid configuration', () => {
    expect(trialConfigSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an arrival rate above the catalog maximum', () => {
    const result = trialConfigSchema.safeParse({
      ...valid,
      arrivalRateRps: catalog.trial.arrivalRateRps.max + 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects seeds outside the unsigned 32-bit range', () => {
    expect(trialConfigSchema.safeParse({ ...valid, seed: -1 }).success).toBe(false);
    expect(trialConfigSchema.safeParse({ ...valid, seed: 2 ** 32 }).success).toBe(false);
    expect(trialConfigSchema.safeParse({ ...valid, seed: 2 ** 32 - 1 }).success).toBe(true);
  });

  it('rejects a measurement window shorter than the catalog minimum', () => {
    const result = trialConfigSchema.safeParse({
      ...valid,
      measurementMs: catalog.trial.measurementMs.min - 1,
    });
    expect(result.success).toBe(false);
  });
});
