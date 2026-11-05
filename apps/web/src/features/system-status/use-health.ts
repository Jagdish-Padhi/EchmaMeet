import type { HealthResponse } from '@chaosboard/contracts';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, createApiClient, describeFailure } from '../../api/client';

export type HealthState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'ready'; readonly health: HealthResponse }
  | { readonly phase: 'failed'; readonly message: string };

interface Settled {
  readonly attempt: number;
  readonly outcome: Exclude<HealthState, { phase: 'loading' }>;
}

const client = createApiClient();

export function useHealth(): { state: HealthState; refresh: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    client
      .getHealth(controller.signal)
      .then((health) => {
        setSettled({ attempt, outcome: { phase: 'ready', health } });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          error instanceof ApiError ? describeFailure(error.failure) : 'Unexpected error.';
        setSettled({ attempt, outcome: { phase: 'failed', message } });
      });
    return () => {
      controller.abort();
    };
  }, [attempt]);

  const refresh = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  // A result from an earlier attempt is stale: show loading until the current attempt settles.
  const state: HealthState = settled?.attempt === attempt ? settled.outcome : { phase: 'loading' };
  return { state, refresh };
}
