import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Fault,
  Invariant,
  RepairIterationRecord,
  RepairProposerKind,
  RunEvent,
  StartRepairRequest,
  Topology,
  TrialConfig,
} from '@chaosboard/contracts';
import type { ApiClient } from '../../../api/client';
import { subscribeToRunEvents, type SseSubscription } from '../../../api/sse';
import type { RepairSessionState } from '../types';

export function useRepairSession(api: ApiClient) {
  const [state, setState] = useState<RepairSessionState>({
    repairId: null,
    status: 'idle',
    proposerKind: 'rule_based',
    maxIterations: 5,
    iterations: [],
    tradeOffReport: null,
    finalRecord: null,
    errorMessage: null,
  });

  const sseSubRef = useRef<SseSubscription | null>(null);

  const setProposerKind = useCallback((proposerKind: RepairProposerKind) => {
    setState((prev) => ({ ...prev, proposerKind }));
  }, []);

  const setMaxIterations = useCallback((maxIterations: number) => {
    setState((prev) => ({ ...prev, maxIterations }));
  }, []);

  const handleRepairEvent = useCallback((event: RunEvent) => {
    setState((prev) => {
      if (
        event.type === 'patch_accepted' ||
        event.type === 'patch_rolled_back' ||
        event.type === 'patch_rejected'
      ) {
        const iteration = event.payload['iteration'] as RepairIterationRecord | undefined;
        if (iteration) {
          const exists = prev.iterations.some((i) => i.iterationIndex === iteration.iterationIndex);
          const nextIterations = exists
            ? prev.iterations.map((i) =>
                i.iterationIndex === iteration.iterationIndex ? iteration : i,
              )
            : [...prev.iterations, iteration];
          return { ...prev, iterations: nextIterations };
        }
      }
      return prev;
    });
  }, []);

  const startRepair = useCallback(
    async (
      topology: Topology,
      fault: Fault,
      invariants: readonly Invariant[],
      trialConfig: TrialConfig,
    ) => {
      if (sseSubRef.current) {
        sseSubRef.current.close();
      }

      setState((prev) => ({
        ...prev,
        status: 'starting',
        iterations: [],
        tradeOffReport: null,
        finalRecord: null,
        errorMessage: null,
      }));

      const request: StartRepairRequest = {
        topology,
        faults: [fault],
        invariants: [...invariants],
        trialConfig,
        proposer: state.proposerKind,
        maxIterations: state.maxIterations,
        timeoutMs: 180_000,
      };

      try {
        const response = await api.startRepair(request);
        const repairId = response.repairId;

        setState((prev) => ({
          ...prev,
          repairId,
          status: 'running',
        }));

        sseSubRef.current = subscribeToRunEvents(`/api/repairs/${repairId}/events`, {
          onEvent: handleRepairEvent,
          onComplete: () => {
            api
              .getRepair(repairId)
              .then((record) => {
                setState((prev) => ({
                  ...prev,
                  status: record.status,
                  finalRecord: record,
                  iterations: record.iterations,
                  tradeOffReport: record.finalReport ?? null,
                }));
              })
              .catch((err: unknown) => {
                setState((prev) => ({
                  ...prev,
                  errorMessage: err instanceof Error ? err.message : String(err),
                }));
              });
          },
          onError: (err) => {
            setState((prev) => ({ ...prev, errorMessage: err.message }));
          },
        });
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [api, state.proposerKind, state.maxIterations, handleRepairEvent],
  );

  const cancelRepair = useCallback(async () => {
    if (!state.repairId) return;
    try {
      await api.cancelRepair(state.repairId);
      setState((prev) => ({ ...prev, status: 'cancelled' }));
      if (sseSubRef.current) {
        sseSubRef.current.close();
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        errorMessage: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [api, state.repairId]);

  useEffect(() => {
    return () => {
      if (sseSubRef.current) {
        sseSubRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    setProposerKind,
    setMaxIterations,
    startRepair,
    cancelRepair,
  };
}
