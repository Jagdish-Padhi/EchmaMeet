import { useEffect, useState } from 'react';
import type { ScenarioId } from '@chaosboard/contracts';
import type { ApiClient } from '../../../api/client';
import type { ScenariosState } from '../types';

export function useScenarios(api: ApiClient) {
  const [state, setState] = useState<ScenariosState>({
    scenarios: [],
    selectedScenarioId: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    api
      .listScenarios(controller.signal)
      .then((scenarios) => {
        setState({
          scenarios,
          selectedScenarioId: scenarios[0]?.id ?? null,
          isLoading: false,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      });

    return () => controller.abort();
  }, [api]);

  const selectScenario = (id: ScenarioId) => {
    setState((prev) => ({ ...prev, selectedScenarioId: id }));
  };

  const selectedScenario = state.scenarios.find((s) => s.id === state.selectedScenarioId) ?? null;

  return {
    ...state,
    selectedScenario,
    selectScenario,
  };
}
