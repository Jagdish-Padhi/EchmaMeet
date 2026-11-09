import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Fault,
  Invariant,
  RepairIterationRecord,
  RepairProposerKind,
  RepairStatus,
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

      if (event.type === 'repair_finished') {
        const payloadStatus = (event.payload['status'] as RepairStatus | undefined) ?? 'repaired';
        const reason = (event.payload['reason'] as string | undefined) ?? null;
        return {
          ...prev,
          status: payloadStatus,
          errorMessage: payloadStatus === 'failed' ? reason : null,
        };
      }

      if (event.type === 'repair_failed') {
        const reason =
          (event.payload['reason'] as string | undefined) ??
          (event.payload['error'] as string | undefined) ??
          'Autonomous repair failed.';
        return {
          ...prev,
          status: 'failed',
          errorMessage: reason,
        };
      }

      return prev;
    });
  }, []);

  const reset = useCallback(() => {
    if (sseSubRef.current) {
      sseSubRef.current.close();
    }
    setState((prev) => ({
      ...prev,
      repairId: null,
      status: 'idle',
      iterations: [],
      tradeOffReport: null,
      finalRecord: null,
      errorMessage: null,
    }));
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

      if (!topology.edges.length) {
        setState((prev) => ({
          ...prev,
          status: 'failed',
          errorMessage:
            'Architecture has no connections. Connect at least two services before starting resilience optimization.',
        }));
        return;
      }

      // Guarantee fault targets a valid edge in active topology
      let effectiveFault = fault;
      if (!topology.edges.some((e) => e.id === fault.edgeId)) {
        effectiveFault = {
          ...fault,
          edgeId: topology.edges[0]!.id,
        };
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
        faults: [effectiveFault],
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
                  errorMessage: record.errorMessage ?? prev.errorMessage,
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
    reset,
  };
}
