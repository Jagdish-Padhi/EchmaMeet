import { describe, expect, it } from 'vitest';
import { faultSchema } from './fault';

const common = {
  id: 'slow-inventory',
  edgeId: 'gateway-to-inventory',
  toxicity: 1,
  direction: 'downstream',
  startOffsetMs: 0,
};

describe('faultSchema', () => {
  it('accepts each fault type with its own parameters', () => {
    const faults = [
      { ...common, type: 'latency', latencyMs: 350, jitterMs: 100 },
      { ...common, type: 'stall', holdMs: null },
      { ...common, type: 'connection_reset', afterMs: 0 },
      { ...common, type: 'slow_close', delayMs: 200 },
      { ...common, type: 'bandwidth_limit', rateKbPerSec: 64 },
      { ...common, type: 'data_limit', maxBytes: 1024 },
      { ...common, type: 'dependency_down' },
    ];
    for (const fault of faults) {
      expect(faultSchema.safeParse(fault).success).toBe(true);
    }
  });

  it('rejects parameters that belong to a different fault type', () => {
    expect(faultSchema.safeParse({ ...common, type: 'stall', latencyMs: 5 }).success).toBe(false);
  });

  it('rejects an unknown fault type', () => {
    expect(faultSchema.safeParse({ ...common, type: 'packet_loss' }).success).toBe(false);
  });

  it('requires toxicity in (0, 1]', () => {
    expect(
      faultSchema.safeParse({ ...common, type: 'latency', latencyMs: 1, jitterMs: 0, toxicity: 0 })
        .success,
    ).toBe(false);
    expect(
      faultSchema.safeParse({
        ...common,
        type: 'latency',
        latencyMs: 1,
        jitterMs: 0,
        toxicity: 1.2,
      }).success,
    ).toBe(false);
    expect(
      faultSchema.safeParse({
        ...common,
        type: 'latency',
        latencyMs: 1,
        jitterMs: 0,
        toxicity: 0.05,
      }).success,
    ).toBe(true);
  });

  it('requires dependency_down to affect every connection', () => {
    expect(
      faultSchema.safeParse({ ...common, type: 'dependency_down', toxicity: 0.5 }).success,
    ).toBe(false);
  });
});
