import type {
  EdgeId,
  EventLoopDelaySummary,
  LoadgenRecord,
  LoadgenSummary,
  NodeId,
  TrialAggregate,
  TrialResult,
  WorkerCounters,
  WorkerSeries,
} from '@chaosboard/contracts';
import {
  computeCompletionRate,
  computeDuplicateWriteRate,
  computeLatencyPercentiles,
  computeMaxQueueDepth,
  computeRetryAmplification,
  computeWorkerSaturation,
} from '../domain/metrics';
import { evaluateTrialValidity, type ValidityLimits } from '../domain/validity';
import { aggregateTrialResults } from '../domain/aggregate';

export interface BuildTrialResultParams {
  trialIndex: number;
  seed: number;
  records: readonly LoadgenRecord[];
  startCounters: Map<string, WorkerCounters>;
  endCounters: Map<string, WorkerCounters>;
  workerSeries: Map<string, WorkerSeries>;
  workerEventLoopDelays: Map<string, EventLoopDelaySummary>;
  nodeMaxWorkers: Map<string, number>;
  edgeIds: readonly string[];
  loadgenSummary: LoadgenSummary;
  processCrash?: string | null;
  limits?: ValidityLimits;
}

export class MeasurementService {
  buildTrialResult(params: BuildTrialResultParams): TrialResult {
    const {
      trialIndex,
      seed,
      records,
      startCounters,
      endCounters,
      workerSeries,
      workerEventLoopDelays,
      nodeMaxWorkers,
      edgeIds,
      loadgenSummary,
      processCrash,
      limits,
    } = params;

    const workerDelaysRecord: Record<string, EventLoopDelaySummary> = {};
    for (const [nodeId, delay] of workerEventLoopDelays.entries()) {
      workerDelaysRecord[nodeId] = delay;
    }

    const validity = evaluateTrialValidity({
      generatorLag: loadgenSummary.sendLag,
      generatorEventLoopDelay: loadgenSummary.eventLoopDelay,
      workerEventLoopDelays: workerDelaysRecord,
      processCrash,
      limits,
    });

    const latency = computeLatencyPercentiles(records);
    const completionRate = computeCompletionRate(records);

    const retryAmplification: Record<EdgeId, number> = {};
    const breakerOpenFraction: Record<EdgeId, number> = {};

    for (const edgeId of edgeIds) {
      // Find source node for this edge
      let start: WorkerCounters | undefined;
      let end: WorkerCounters | undefined;

      for (const [nodeId, counters] of endCounters.entries()) {
        if (counters.attemptsOut[edgeId as EdgeId] !== undefined) {
          start = startCounters.get(nodeId);
          end = counters;
          break;
        }
      }

      if (start && end) {
        retryAmplification[edgeId as EdgeId] = computeRetryAmplification(
          start,
          end,
          edgeId as EdgeId,
        );
        const transitions =
          (end.breakerTransitions[edgeId as EdgeId] ?? 0) -
          (start.breakerTransitions[edgeId as EdgeId] ?? 0);
        breakerOpenFraction[edgeId as EdgeId] = transitions > 0 ? 0.5 : 0;
      } else {
        retryAmplification[edgeId as EdgeId] = 1;
        breakerOpenFraction[edgeId as EdgeId] = 0;
      }
    }

    const workerSaturation: Record<NodeId, number> = {};
    const maxQueueDepth: Record<NodeId, number> = {};

    for (const [nodeId, series] of workerSeries.entries()) {
      const maxWorkers = nodeMaxWorkers.get(nodeId) ?? 1;
      workerSaturation[nodeId as NodeId] = computeWorkerSaturation(series, maxWorkers);
      maxQueueDepth[nodeId as NodeId] = computeMaxQueueDepth(series);
    }

    let duplicateWriteRate: number | null = null;
    for (const [nodeId, end] of endCounters.entries()) {
      const start = startCounters.get(nodeId);
      if (start && (end.ledgerDuplicates > 0 || start.ledgerDuplicates > 0)) {
        duplicateWriteRate = computeDuplicateWriteRate(start, end);
        break;
      }
    }

    const measurementRecords = records.filter((r) => r.phase === 'measurement');
    const totalScheduledRequests = measurementRecords.length;
    const totalCompletedRequests = measurementRecords.filter(
      (r) => r.statusClass === 'success_2xx',
    ).length;

    return {
      trialIndex,
      seed,
      validity,
      metrics: {
        p99LatencyMs: latency.p99Ms,
        p50LatencyMs: latency.p50Ms,
        completionRate,
        retryAmplification,
        workerSaturation,
        maxQueueDepth,
        duplicateWriteRate,
        breakerOpenFraction,
      },
      diagnostics: {
        generatorLag: loadgenSummary.sendLag,
        generatorEventLoopDelay: loadgenSummary.eventLoopDelay,
        workerEventLoopDelays: workerDelaysRecord,
        totalScheduledRequests,
        totalCompletedRequests,
      },
    };
  }

  aggregateTrials(trials: readonly TrialResult[]): TrialAggregate {
    return aggregateTrialResults(trials);
  }
}
