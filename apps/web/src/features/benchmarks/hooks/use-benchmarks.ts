import { useEffect, useState } from 'react';
import type { ApiClient } from '../../../api/client';
import type { BenchmarksState } from '../types';

export function useBenchmarks(api: ApiClient) {
  const [state, setState] = useState<BenchmarksState>({
    summary: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    api
      .getBenchmarkResults(controller.signal)
      .then((summary) => {
        setState({ summary, isLoading: false, error: null });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setState({
          summary: null,
          isLoading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return () => controller.abort();
  }, [api]);

  return state;
}
