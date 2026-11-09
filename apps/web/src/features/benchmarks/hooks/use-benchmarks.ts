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
    let cancelled = false;
    let controller: AbortController | null = null;

    const fetchBenchmarks = () => {
      controller?.abort();
      controller = new AbortController();

      api
        .getBenchmarkResults(controller.signal)
        .then((summary) => {
          if (!cancelled) {
            setState({ summary, isLoading: false, error: null });
          }
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (!cancelled) {
            setState({
              summary: null,
              isLoading: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        });
    };

    fetchBenchmarks();

    const handleAuth = () => {
      fetchBenchmarks();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('chaosboard:authenticated', handleAuth);
    }

    return () => {
      cancelled = true;
      controller?.abort();
      if (typeof window !== 'undefined') {
        window.removeEventListener('chaosboard:authenticated', handleAuth);
      }
    };
  }, [api]);

  return state;
}
