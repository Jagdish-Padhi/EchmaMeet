import { describe, it, expect } from 'vitest';
import { ExperimentLock } from '../domain/experiment-lock';
import { EventBroadcaster } from '../infrastructure/event-broadcaster';
import { runIdSchema, type RunEvent } from '@chaosboard/contracts';

describe('experiments domain and infrastructure unit tests', () => {
  const run1 = runIdSchema.parse('run-11111111-1111-1111-1111-111111111111');
  const run2 = runIdSchema.parse('run-22222222-2222-2222-2222-222222222222');

  it('manages single-host mutual exclusion lock', () => {
    const lock = new ExperimentLock();
    expect(lock.isLocked()).toBe(false);

    lock.acquire(run1);
    expect(lock.isLocked()).toBe(true);
    expect(lock.getActiveRunId()).toBe(run1);

    // Second acquire throws conflict
    expect(() => lock.acquire(run2)).toThrow(/already running/);

    // Release allows next acquire
    lock.release(run1);
    expect(lock.isLocked()).toBe(false);

    lock.acquire(run2);
    expect(lock.isLocked()).toBe(true);
    lock.release(run2);
  });

  it('broadcasts events to subscribers and unsubscribes cleanly', () => {
    const broadcaster = new EventBroadcaster();
    const received: RunEvent[] = [];

    const unsubscribe = broadcaster.subscribe(run1, (event: RunEvent) => {
      received.push(event);
    });

    const event1: RunEvent = {
      runId: run1,
      sequence: 0,
      timestampMs: 1000,
      type: 'experiment_started',
      payload: {},
    };
    const eventOther: RunEvent = {
      runId: run2,
      sequence: 0,
      timestampMs: 1000,
      type: 'experiment_started',
      payload: {},
    };

    broadcaster.broadcast(event1);
    broadcaster.broadcast(eventOther); // should not reach subscriber for run1

    expect(received.length).toBe(1);
    expect(received[0]?.runId).toBe(run1);

    unsubscribe();
    broadcaster.broadcast(event1);
    expect(received.length).toBe(1); // no new events
  });
});
