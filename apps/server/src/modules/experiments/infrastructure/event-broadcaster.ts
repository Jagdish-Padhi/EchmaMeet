import type { RunEvent, RunId } from '@chaosboard/contracts';
import type { EventBroadcasterPort } from '../application/ports';

export type EventListener = (event: RunEvent) => void;

export class EventBroadcaster implements EventBroadcasterPort {
  private readonly listeners = new Map<RunId, Set<EventListener>>();

  subscribe(runId: RunId, listener: EventListener): () => void {
    let set = this.listeners.get(runId);
    if (!set) {
      set = new Set();
      this.listeners.set(runId, set);
    }
    set.add(listener);

    return () => {
      const current = this.listeners.get(runId);
      if (current) {
        current.delete(listener);
        if (current.size === 0) {
          this.listeners.delete(runId);
        }
      }
    };
  }

  broadcast(event: RunEvent): void {
    const set = this.listeners.get(event.runId);
    if (set) {
      for (const listener of set) {
        try {
          listener(event);
        } catch {
          // Ignore listener errors to avoid breaking event propagation
        }
      }
    }
  }
}
