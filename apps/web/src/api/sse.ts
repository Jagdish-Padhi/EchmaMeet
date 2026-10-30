import { runEventSchema, type RunEvent } from '@chaosboard/contracts';

export interface SseSubscriptionOptions {
  readonly onEvent: (event: RunEvent) => void;
  readonly onError?: (error: Error) => void;
  readonly onComplete?: () => void;
  readonly eventSourceFactory?: (url: string) => EventSource;
}

export interface SseSubscription {
  readonly close: () => void;
}

export function subscribeToRunEvents(
  url: string,
  options: SseSubscriptionOptions,
): SseSubscription {
  const factory =
    options.eventSourceFactory ??
    ((targetUrl: string) => {
      if (typeof EventSource === 'undefined') {
        throw new Error('EventSource is not supported in this environment');
      }
      return new EventSource(targetUrl);
    });

  let source: EventSource;

  try {
    source = factory(url);
  } catch (err: unknown) {
    if (options.onError) {
      options.onError(err instanceof Error ? err : new Error(String(err)));
    }
    return { close: () => {} };
  }

  const activeSource = source;
  let closed = false;

  const handleMessage = (event: MessageEvent<string>) => {
    if (closed) return;
    try {
      const raw = JSON.parse(event.data) as unknown;
      const parsed = runEventSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(
          `Event validation failed: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
        );
      }
      options.onEvent(parsed.data);

      if (
        parsed.data.type === 'experiment_finished' ||
        parsed.data.type === 'experiment_failed' ||
        parsed.data.type === 'experiment_cancelled' ||
        parsed.data.type === 'repair_finished' ||
        parsed.data.type === 'repair_failed' ||
        parsed.data.type === 'repair_cancelled'
      ) {
        closed = true;
        activeSource.close();
        options.onComplete?.();
      }
    } catch (err: unknown) {
      if (options.onError) {
        options.onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleError = () => {
    if (closed) return;
    if (options.onError) {
      options.onError(new Error('EventSource encountered a connection error'));
    }
  };

  activeSource.addEventListener('message', handleMessage as EventListener);
  activeSource.addEventListener('error', handleError as EventListener);

  return {
    close: () => {
      if (!closed) {
        closed = true;
        activeSource.removeEventListener('message', handleMessage as EventListener);
        activeSource.removeEventListener('error', handleError as EventListener);
        activeSource.close();
      }
    },
  };
}
