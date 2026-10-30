import { describe, it, expect } from 'vitest';
import { loadgenConfigSchema, type LoadgenConfig } from './loadgen-config';

describe('loadgenConfigSchema', () => {
  const validConfig: LoadgenConfig = {
    targetUrl: 'http://127.0.0.1:22000/request',
    arrivalProcess: 'constant',
    arrivalRateRps: 50,
    warmupDurationMs: 500,
    measurementDurationMs: 2000,
    cooldownDurationMs: 500,
    clientTimeoutMs: 3000,
    seed: 42,
    requestIdPrefix: 'test-req',
    method: 'POST',
    headers: { 'x-custom': 'val' },
    body: '{"foo":"bar"}',
  };

  it('accepts valid loadgen configurations', () => {
    const parsed = loadgenConfigSchema.parse(validConfig);
    expect(parsed.arrivalProcess).toBe('constant');
    expect(parsed.arrivalRateRps).toBe(50);
  });

  it('accepts poisson arrival process', () => {
    const parsed = loadgenConfigSchema.parse({
      ...validConfig,
      arrivalProcess: 'poisson',
    });
    expect(parsed.arrivalProcess).toBe('poisson');
  });

  it('rejects invalid arrival processes', () => {
    expect(() =>
      loadgenConfigSchema.parse({
        ...validConfig,
        arrivalProcess: 'gaussian',
      }),
    ).toThrow();
  });

  it('rejects negative or zero rates', () => {
    expect(() =>
      loadgenConfigSchema.parse({
        ...validConfig,
        arrivalRateRps: 0,
      }),
    ).toThrow();

    expect(() =>
      loadgenConfigSchema.parse({
        ...validConfig,
        arrivalRateRps: -10,
      }),
    ).toThrow();
  });

  it('rejects invalid URLs', () => {
    expect(() =>
      loadgenConfigSchema.parse({
        ...validConfig,
        targetUrl: 'not-a-valid-url',
      }),
    ).toThrow();
  });
});
