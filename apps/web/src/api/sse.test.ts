import { describe, expect, it } from 'vitest';
import type { RunEvent } from '@chaosboard/contracts';
import { subscribeToRunEvents } from './sse';

class FakeEventSource {
  private listeners: Record<string, EventListener[]> = {};
  public closed = false;

  constructor(public readonly url: string) {}

  addEventListener(type: string, listener: EventListener): void {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type]?.push(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    const list = this.listeners[type];
    if (list) {
      this.listeners[type] = list.filter((l) => l !== listener);
    }
  }

  emit(type: string, data: string): void {
    const list = this.listeners[type];
    if (list) {
      for (const l of list) {
        l({ data } as MessageEvent);
      }
    }
  }

  emitError(): void {
    const list = this.listeners['error'];
    if (list) {
      for (const l of list) {
        l(new Event('error'));
      }
    }
  }

  close(): void {
    this.closed = true;
  }
}

describe('subscribeToRunEvents', () => {
  it('parses valid events and invokes onEvent', () => {
    let fakeSource: FakeEventSource | undefined;
    const received: RunEvent[] = [];

    const sub = subscribeToRunEvents('/api/experiments/123/events', {
      eventSourceFactory: (url) => {
        const src = new FakeEventSource(url);
        fakeSource = src;
        return src as unknown as EventSource;
      },
      onEvent: (ev) => received.push(ev),
    });

    const validEvent = {
      runId: 'run-12345678-abcd-1234-abcd-1234567890ab',
      sequence: 1,
      timestampMs: 1730280000000,
      type: 'trial_started',
      payload: { trialIndex: 0 },
    };

    fakeSource?.emit('message', JSON.stringify(validEvent));
    expect(received.length).toBe(1);
    expect(received[0]?.type).toBe('trial_started');

    sub.close();
    expect(fakeSource?.closed).toBe(true);
  });

  it('reports error on invalid contract payload', () => {
    let fakeSource: FakeEventSource | undefined;
    let reportedError: Error | null = null;

    subscribeToRunEvents('/api/experiments/123/events', {
      eventSourceFactory: (url) => {
        const src = new FakeEventSource(url);
        fakeSource = src;
        return src as unknown as EventSource;
      },
      onEvent: () => {},
      onError: (err) => {
        reportedError = err;
      },
    });

    fakeSource?.emit('message', JSON.stringify({ invalid: true }));
    expect(reportedError).not.toBeNull();
    expect((reportedError as unknown as Error).message).toContain('Event validation failed');
  });

  it('closes automatically on experiment_finished', () => {
    let fakeSource: FakeEventSource | undefined;
    let completed = false;

    subscribeToRunEvents('/api/experiments/123/events', {
      eventSourceFactory: (url) => {
        const src = new FakeEventSource(url);
        fakeSource = src;
        return src as unknown as EventSource;
      },
      onEvent: () => {},
      onComplete: () => {
        completed = true;
      },
    });

    const completionEvent = {
      runId: 'run-12345678-abcd-1234-abcd-1234567890ab',
      sequence: 2,
      timestampMs: 1730280005000,
      type: 'experiment_finished',
      payload: {},
    };

    fakeSource?.emit('message', JSON.stringify(completionEvent));
    expect(completed).toBe(true);
    expect(fakeSource?.closed).toBe(true);
  });
});
