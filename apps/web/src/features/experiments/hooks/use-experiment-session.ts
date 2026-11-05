import { useCallback, useEffect, useRef, useState } from 'react';
import {
  faultIdSchema,
  invariantIdSchema,
  metricScopeKind,
  type EdgeId,
  type Fault,
  type Invariant,
  type RunEvent,
  type StartExperimentRequest,
  type Topology,
  type TrialConfig,
} from '@chaosboard/contracts';
import { ApiError, type ApiClient } from '../../../api/client';
import { subscribeToRunEvents, type SseSubscription } from '../../../api/sse';
import type { ExperimentSessionState } from '../types';

export function useExperimentSession(api: ApiClient, currentTopology: Topology | null) {
  const [state, setState] = useState<ExperimentSessionState>(() => {
    const defaultEdge = currentTopology?.edges[0]?.id ?? ('gateway-to-inventory' as EdgeId);
    return {
      runId: null,
      status: 'idle',
      fault: {
        id: faultIdSchema.parse('fault-default'),
        edgeId: defaultEdge,
        toxicity: 1,
        direction: 'downstream',
        startOffsetMs: 0,
        type: 'latency',
        latencyMs: 800,
        jitterMs: 100,
      },
      invariants: [
        {
          id: invariantIdSchema.parse('inv-p99'),
          scope: { kind: 'system' },
          metric: 'e2e_p99_ms',
          comparator: 'lte',
          threshold: 500,
        },
        {
          id: invariantIdSchema.parse('inv-completion'),
          scope: { kind: 'system' },
          metric: 'completion_rate',
          comparator: 'gte',
          threshold: 0.95,
        },
      ],
      trialConfig: {
        arrivalRateRps: 20,
        arrivalProcess: 'constant',
        warmupMs: 1000,
        measurementMs: 5000,
        cooldownMs: 1000,
        clientTimeoutMs: 5000,
        seed: 42,
        trials: 3,
      },
      currentTrialIndex: 0,
      totalTrials: 6, // 3 baseline + 3 faulted
      liveEvents: [],
      telemetry: [],
      finalRecord: null,
      verdicts: null,
      overallStatus: null,
      errorMessage: null,
    };
  });

  const sseSubRef = useRef<SseSubscription | null>(null);

  const updateFault = useCallback((fault: Fault) => {
    setState((prev) => ({ ...prev, fault }));
  }, []);

  const updateInvariants = useCallback((invariants: readonly Invariant[]) => {
    setState((prev) => ({ ...prev, invariants }));
  }, []);

  const updateTrialConfig = useCallback((trialConfig: TrialConfig) => {
    setState((prev) => ({
      ...prev,
      trialConfig,
      totalTrials: trialConfig.trials * 2,
    }));
  }, []);

  const handleLiveEvent = useCallback((event: RunEvent) => {
    setState((prev) => {
      const nextEvents = [...prev.liveEvents, event];
      let currentTrial = prev.currentTrialIndex;
      const telemetryPoints = [...prev.telemetry];

      if (event.type === 'trial_started') {
        const trialIdx = (event.payload['trialIndex'] as number | undefined) ?? 0;
        const phase = event.payload['phase'] as string | undefined;
        const baselineOffset = phase === 'faulted' ? prev.trialConfig.trials : 0;
        currentTrial = baselineOffset + trialIdx + 1;
      }

      if (event.type === 'trial_finished') {
        const payload = event.payload;
        const metrics = (payload['metrics'] as Record<string, unknown> | undefined) ?? payload;
        const p99 = (metrics['p99LatencyMs'] ?? metrics['p99_latency_ms']) as number | undefined;
        const p95 = (metrics['p95LatencyMs'] ?? metrics['p95_latency_ms']) as number | undefined;
        const p50 = (metrics['p50LatencyMs'] ?? metrics['p50_latency_ms']) as number | undefined;
        const completionRate = (metrics['completionRate'] ?? metrics['completion_rate']) as
          number | undefined;
        const errorRate = (metrics['errorRate'] ??
          metrics['error_rate'] ??
          (completionRate !== undefined ? 1 - completionRate : undefined)) as number | undefined;

        if (p99 !== undefined || errorRate !== undefined) {
          telemetryPoints.push({
            timestampMs: event.timestampMs,
            p50LatencyMs: p50 ?? (p99 ? Math.round(p99 * 0.4) : undefined),
            p95LatencyMs: p95 ?? (p99 ? Math.round(p99 * 0.85) : undefined),
            p99LatencyMs: p99,
            errorRate: errorRate ?? 0,
          });
        }
      }

      if (event.type === 'experiment_failed') {
        const errorMsg = (event.payload['error'] as string | undefined) ?? 'Simulation failed.';
        return {
          ...prev,
          status: 'failed',
          errorMessage: errorMsg,
          liveEvents: nextEvents,
        };
      }

      if (event.type === 'experiment_cancelled') {
        return {
          ...prev,
          status: 'cancelled',
          errorMessage: 'Simulation was cancelled.',
          liveEvents: nextEvents,
        };
      }

      return {
        ...prev,
        liveEvents: nextEvents,
        currentTrialIndex: currentTrial,
        telemetry: telemetryPoints,
      };
    });
  }, []);

  const startExperiment = useCallback(
    async (topology: Topology) => {
      if (!topology || !topology.nodes || topology.nodes.length === 0) {
        setState((prev) => ({
          ...prev,
          status: 'failed',
          errorMessage:
            'Cannot simulate an empty canvas. Add at least one service to start testing.',
        }));
        return;
      }

      if (sseSubRef.current) {
        sseSubRef.current.close();
      }

      setState((prev) => ({
        ...prev,
        status: 'starting',
        errorMessage: null,
        liveEvents: [],
        telemetry: [],
        finalRecord: null,
        verdicts: null,
        overallStatus: null,
        currentTrialIndex: 0,
        totalTrials: prev.trialConfig.trials * 2,
      }));

      const targetEdge =
        topology.edges.find((e) => e.id === state.fault.edgeId) ?? topology.edges[0];

      // Build clean typed fault strictly conforming to faultSchema
      let faultToRun: Fault | null = null;
      if (targetEdge) {
        const edgeId = targetEdge.id;
        const common = {
          id: state.fault.id,
          edgeId,
          toxicity:
            typeof state.fault.toxicity === 'number' &&
            state.fault.toxicity > 0 &&
            state.fault.toxicity <= 1
              ? state.fault.toxicity
              : 1,
          direction:
            state.fault.direction === 'upstream'
              ? ('upstream' as const)
              : ('downstream' as const),
          startOffsetMs:
            typeof state.fault.startOffsetMs === 'number'
              ? Math.max(0, Math.min(30000, state.fault.startOffsetMs))
              : 0,
        };

        const raw = state.fault as Record<string, unknown>;
        switch (state.fault.type) {
          case 'latency':
            faultToRun = {
              ...common,
              type: 'latency',
              latencyMs: typeof raw['latencyMs'] === 'number' ? (raw['latencyMs'] as number) : 500,
              jitterMs: typeof raw['jitterMs'] === 'number' ? (raw['jitterMs'] as number) : 50,
            };
            break;
          case 'stall':
            faultToRun = {
              ...common,
              type: 'stall',
              holdMs: typeof raw['holdMs'] === 'number' ? (raw['holdMs'] as number) : null,
            };
            break;
          case 'connection_reset':
            faultToRun = {
              ...common,
              type: 'connection_reset',
              afterMs: typeof raw['afterMs'] === 'number' ? (raw['afterMs'] as number) : 0,
            };
            break;
          case 'bandwidth_limit':
            faultToRun = {
              ...common,
              type: 'bandwidth_limit',
              rateKbPerSec:
                typeof raw['rateKbPerSec'] === 'number' ? (raw['rateKbPerSec'] as number) : 1024,
            };
            break;
          case 'slow_close':
            faultToRun = {
              ...common,
              type: 'slow_close',
              delayMs: typeof raw['delayMs'] === 'number' ? (raw['delayMs'] as number) : 100,
            };
            break;
          case 'data_limit':
            faultToRun = {
              ...common,
              type: 'data_limit',
              maxBytes: typeof raw['maxBytes'] === 'number' ? (raw['maxBytes'] as number) : 4096,
            };
            break;
          case 'dependency_down':
          default:
            faultToRun = {
              ...common,
              type: 'dependency_down',
              toxicity: 1,
            };
            break;
        }
      }

      // Sanitize invariants to guarantee valid scope matching against current topology
      const validInvariants = state.invariants.map((inv) => {
        const expectedScopeKind = metricScopeKind[inv.metric] ?? 'system';
        const sanitizedThreshold =
          typeof inv.threshold === 'number' && !Number.isNaN(inv.threshold)
            ? Math.max(0, inv.threshold)
            : 0;

        if (expectedScopeKind === 'system') {
          return {
            ...inv,
            scope: { kind: 'system' as const },
            threshold: sanitizedThreshold,
          };
        }
        if (expectedScopeKind === 'node') {
          const currentScope = inv.scope;
          const nodeExists =
            currentScope.kind === 'node' && topology.nodes.some((n) => n.id === currentScope.nodeId);
          const validNodeId =
            nodeExists && currentScope.kind === 'node'
              ? currentScope.nodeId
              : topology.nodes[0]?.id ?? ('node-1' as any);
          return {
            ...inv,
            scope: { kind: 'node' as const, nodeId: validNodeId },
            threshold: sanitizedThreshold,
          };
        }
        if (expectedScopeKind === 'edge') {
          const currentScope = inv.scope;
          const edgeExists =
            currentScope.kind === 'edge' && topology.edges.some((e) => e.id === currentScope.edgeId);
          const validEdgeId =
            edgeExists && currentScope.kind === 'edge'
              ? currentScope.edgeId
              : topology.edges[0]?.id ?? ('edge-1' as any);
          return {
            ...inv,
            scope: { kind: 'edge' as const, edgeId: validEdgeId },
            threshold: sanitizedThreshold,
          };
        }
        return inv;
      });

      const request: StartExperimentRequest = {
        topology,
        faults: faultToRun ? [faultToRun] : [],
        invariants: validInvariants,
        trialConfig: state.trialConfig,
      };

      try {
        const response = await api.startExperiment(request);
        const runId = response.runId;

        setState((prev) => ({
          ...prev,
          runId,
          status: 'running',
        }));

        sseSubRef.current = subscribeToRunEvents(`/api/experiments/${runId}/events`, {
          onEvent: handleLiveEvent,
          onComplete: () => {
            api
              .getExperiment(runId)
              .then((record) => {
                setState((prev) => ({
                  ...prev,
                  status:
                    record.status === 'cancelled'
                      ? 'cancelled'
                      : record.status === 'failed'
                        ? 'failed'
                        : 'completed',
                  finalRecord: record,
                  verdicts: record.verdicts,
                  overallStatus: record.overallStatus,
                  errorMessage: record.errorMessage ?? prev.errorMessage,
                }));
              })
              .catch((err: unknown) => {
                setState((prev) => ({
                  ...prev,
                  status: 'failed',
                  errorMessage: err instanceof Error ? err.message : String(err),
                }));
              });
          },
          onError: (err) => {
            let pollAttempts = 0;
            const maxPollAttempts = 45;
            const pollInterval = setInterval(() => {
              pollAttempts += 1;
              api
                .getExperiment(runId)
                .then((record) => {
                  if (record.status === 'running') {
                    if (pollAttempts >= maxPollAttempts) {
                      clearInterval(pollInterval);
                      setState((prev) => ({
                        ...prev,
                        status: 'failed',
                        errorMessage: 'Simulation exceeded timeout window.',
                      }));
                    }
                    return;
                  }

                  clearInterval(pollInterval);
                  setState((prev) => ({
                    ...prev,
                    status:
                      record.status === 'cancelled'
                        ? 'cancelled'
                        : record.status === 'failed'
                          ? 'failed'
                          : 'completed',
                    finalRecord: record,
                    verdicts: record.verdicts,
                    overallStatus: record.overallStatus,
                    errorMessage:
                      record.errorMessage ?? (record.status === 'failed' ? err.message : null),
                  }));
                })
                .catch(() => {
                  if (pollAttempts >= maxPollAttempts) {
                    clearInterval(pollInterval);
                    setState((prev) => ({
                      ...prev,
                      status: 'failed',
                      errorMessage: err.message,
                    }));
                  }
                });
            }, 1000);
          },
        });
      } catch (err) {
        if (err instanceof ApiError && err.failure.kind === 'problem') {
          if (err.failure.problem.code === 'experiment_busy') {
            setState((prev) => ({
              ...prev,
              status: 'busy',
              errorMessage:
                'Host lock active: another experiment is currently running or releasing resources. You can wait a moment or click Force Release Lock to reset.',
            }));
            return;
          }
        }
        setState((prev) => ({
          ...prev,
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [api, state.fault, state.invariants, state.trialConfig, handleLiveEvent],
  );

  const forceResetExperiment = useCallback(async () => {
    try {
      await api.resetExperimentLock();
    } catch {
      // Fallback
    }
    if (sseSubRef.current) {
      sseSubRef.current.close();
      sseSubRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      status: 'idle',
      runId: null,
      errorMessage: null,
      liveEvents: [],
      telemetry: [],
      finalRecord: null,
      verdicts: null,
      overallStatus: null,
    }));
  }, [api]);

  const cancelExperiment = useCallback(async () => {
    if (!state.runId) return;
    try {
      await api.cancelExperiment(state.runId);
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
  }, [api, state.runId]);

  useEffect(() => {
    return () => {
      if (sseSubRef.current) {
        sseSubRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    updateFault,
    updateInvariants,
    updateTrialConfig,
    startExperiment,
    cancelExperiment,
    forceResetExperiment,
  };
}
