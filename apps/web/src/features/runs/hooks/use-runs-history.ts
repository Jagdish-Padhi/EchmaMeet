import { useCallback, useEffect, useState } from 'react';
import type { RunId } from '@chaosboard/contracts';
import type { ApiClient } from '../../../api/client';
import type { RunsHistoryState } from '../types';

export function useRunsHistory(api: ApiClient) {
  const [state, setState] = useState<RunsHistoryState>({
    runs: [],
    selectedRunId: null,
    selectedRunRecord: null,
    replayingEvents: null,
    isLoading: true,
    error: null,
  });

  const refreshRuns = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    api
      .listRuns(50)
      .then((runs) => {
        setState((prev) => ({ ...prev, runs, isLoading: false, error: null }));
      })
      .catch((err: unknown) => {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      });
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    const fetchRuns = () => {
      api
        .listRuns(50)
        .then((runs) => {
          if (!cancelled) {
            setState((prev) => ({ ...prev, runs, isLoading: false, error: null }));
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setState((prev) => ({
              ...prev,
              isLoading: false,
              error: err instanceof Error ? err.message : String(err),
            }));
          }
        });
    };

    fetchRuns();

    const handleAuth = () => {
      fetchRuns();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('chaosboard:authenticated', handleAuth);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('chaosboard:authenticated', handleAuth);
      }
    };
  }, [api]);

  const viewRun = useCallback(
    (id: RunId) => {
      setState((prev) => ({ ...prev, selectedRunId: id }));
      api
        .getRun(id)
        .then((record) => {
          setState((prev) => ({ ...prev, selectedRunRecord: record }));
        })
        .catch((err: unknown) => {
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : String(err),
          }));
        });
    },
    [api],
  );

  const startReplay = useCallback(
    (id: RunId) => {
      setState((prev) => ({ ...prev, selectedRunId: id }));
      api
        .getRunEvents(id)
        .then((events) => {
          setState((prev) => ({ ...prev, replayingEvents: events }));
        })
        .catch((err: unknown) => {
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : String(err),
          }));
        });
    },
    [api],
  );

  const closeReplay = useCallback(() => {
    setState((prev) => ({ ...prev, replayingEvents: null }));
  }, []);

  const closeDetail = useCallback(() => {
    setState((prev) => ({ ...prev, selectedRunId: null, selectedRunRecord: null }));
  }, []);

  const exportRunJson = useCallback(
    (id: RunId) => {
      api
        .exportRun(id)
        .then((record) => {
          const blob = new Blob([JSON.stringify(record, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${id}.json`;
          a.click();
          URL.revokeObjectURL(url);
        })
        .catch((err: unknown) => {
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : String(err),
          }));
        });
    },
    [api],
  );

  return {
    ...state,
    refreshRuns,
    viewRun,
    closeDetail,
    startReplay,
    closeReplay,
    exportRunJson,
  };
}
