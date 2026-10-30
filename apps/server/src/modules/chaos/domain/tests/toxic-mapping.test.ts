import { describe, it, expect } from 'vitest';
import { mapFaultToToxic } from '../toxic-mapping';
import { faultSchema, type Fault } from '@chaosboard/contracts';

describe('mapFaultToToxic', () => {
  it('maps latency fault to Toxiproxy latency toxic', () => {
    const fault: Fault = faultSchema.parse({
      id: 'f-lat',
      edgeId: 'edge-1',
      type: 'latency',
      toxicity: 0.8,
      direction: 'downstream',
      startOffsetMs: 500,
      latencyMs: 350,
      jitterMs: 50,
    });

    const toxic = mapFaultToToxic(fault);
    expect(toxic.type).toBe('latency');
    expect(toxic.stream).toBe('downstream');
    expect(toxic.toxicity).toBe(0.8);
    expect(toxic.attributes['latency']).toBe(350);
    expect(toxic.attributes['jitter']).toBe(50);
  });

  it('maps stall fault to timeout toxic', () => {
    const fault: Fault = faultSchema.parse({
      id: 'f-stall',
      edgeId: 'edge-2',
      type: 'stall',
      toxicity: 1,
      direction: 'downstream',
      startOffsetMs: 0,
      holdMs: 1500,
    });

    const toxic = mapFaultToToxic(fault);
    expect(toxic.type).toBe('timeout');
    expect(toxic.attributes['timeout']).toBe(1500);
  });

  it('maps dependency_down to timeout 0 with toxicity 1', () => {
    const fault: Fault = faultSchema.parse({
      id: 'f-down',
      edgeId: 'edge-3',
      type: 'dependency_down',
      toxicity: 1,
      direction: 'downstream',
      startOffsetMs: 0,
    });

    const toxic = mapFaultToToxic(fault);
    expect(toxic.type).toBe('timeout');
    expect(toxic.toxicity).toBe(1);
    expect(toxic.attributes['timeout']).toBe(0);
  });
});
