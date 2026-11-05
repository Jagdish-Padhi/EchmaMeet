import { describe, it, expect } from 'vitest';
import { runEventSchema } from './run-event';
import { runIdSchema } from '../common/ids';

describe('run event contract', () => {
  const runId = runIdSchema.parse('run-12345678-1234-1234-1234-123456789abc');

  it('accepts valid run event', () => {
    const event = runEventSchema.parse({
      runId,
      sequence: 0,
      timestampMs: 1730000000000,
      type: 'experiment_started',
      payload: { topologyId: 'retry-storm' },
    });
    expect(event.type).toBe('experiment_started');
    expect(event.sequence).toBe(0);
  });

  it('rejects invalid event type', () => {
    expect(() =>
      runEventSchema.parse({
        runId,
        sequence: 1,
        timestampMs: 1730000000000,
        type: 'non_existent_event_type',
        payload: {},
      }),
    ).toThrow();
  });
});
