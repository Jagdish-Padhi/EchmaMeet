import { randomUUID } from 'node:crypto';
import {
  runIdSchema,
  type LoadgenConfig,
  type RunEvent,
  type RunEventType,
  type RunId,
  type RunRecord,
  type StartExperimentRequest,
  type TrialResult,
} from '@chaosboard/contracts';
import { AppError } from '@chaosboard/shared';

class CancelledError extends Error {
  constructor() {
    super('Experiment was cancelled by user.');
    this.name = 'CancelledError';
  }
}
import type { ExperimentLock } from '../domain/experiment-lock';
import { validateTopologyInput } from '../../topology';
import type {
  ChaosPort,
  EventBroadcasterPort,
  ExperimentOrchestratorPort,
  MeasurementPort,
  RunsPort,
  SandboxPort,
} from './ports';
import type { LoadgenHandle, SandboxHandle } from '../../sandbox';

interface ActiveExecution {
  isCancelled: () => boolean;
  markCancelled: () => void;
  activeSandbox: SandboxHandle | null;
  activeLoadgen: LoadgenHandle | null;
  donePromise?: Promise<void>;
}

export class ExperimentOrchestrator implements ExperimentOrchestratorPort {
  private readonly activeExecutions = new Map<RunId, ActiveExecution>();

  constructor(
    private readonly lock: ExperimentLock,
    private readonly broadcaster: EventBroadcasterPort,
    private readonly runs: RunsPort,
    private readonly chaos: ChaosPort,
    private readonly sandbox: SandboxPort,
    private readonly measurement: MeasurementPort,
  ) {}

  async start(request: StartExperimentRequest): Promise<RunId> {
    // 0. Preflight Architecture Validation: Reject invalid or incomplete topologies before acquiring host lock
    if (request.topology.nodes.length === 0) {
      throw new AppError(
        'validation',
        'topology_empty',
        'Cannot simulate an empty canvas. Add at least one service to start resilience testing.',
      );
    }

    const validation = validateTopologyInput(request.topology);
    if (!validation.valid) {
      const topProblem = validation.problems[0];
      const message = topProblem ? topProblem.message : 'Invalid topology structure.';
      throw new AppError(
        'validation',
        topProblem?.code ?? 'topology_invalid',
        `Preflight validation failed: ${message}`,
      );
    }

    const rawId = `run-${randomUUID()}`;
    const runId = runIdSchema.parse(rawId);

    // Atomic single-experiment host lock: throws conflict if another is running
    this.lock.acquire(runId);

    const now = new Date().toISOString();
    const toxiproxyVersion = await (
      this.chaos.verifyConnection?.() ?? Promise.resolve('unknown')
    ).catch(() => 'unreachable');
    const provenance = {
      gitCommit: process.env['GIT_COMMIT'] ?? 'local',
      hostDescription: `${process.platform}-${process.arch}`,
      nodeVersion: process.version,
      toxiproxyVersion,
      startedAt: now,
    };

    const initialRecord: RunRecord = {
      id: runId,
      status: 'running',
      topology: request.topology,
      faults: request.faults,
      invariants: request.invariants,
      trialConfig: request.trialConfig,
      baselineAggregate: null,
      faultedAggregate: null,
      verdicts: [],
      overallStatus: null,
      provenance,
      createdAt: now,
      finishedAt: null,
      errorMessage: null,
    };

    this.runs.createRun(initialRecord);

    let cancelledFlag = false;
    const exec: ActiveExecution = {
      isCancelled: () => cancelledFlag,
      markCancelled: () => {
        cancelledFlag = true;
      },
      activeSandbox: null,
      activeLoadgen: null,
    };
    this.activeExecutions.set(runId, exec);

    // Run execution asynchronously in background so start() returns runId immediately
    const donePromise = this.executeExperiment(runId, request, exec);
    exec.donePromise = donePromise;

    return Promise.resolve(runId);
  }

  async cancel(runId: RunId): Promise<void> {
    const exec = this.activeExecutions.get(runId);
    if (!exec) {
      const run = this.runs.getRun(runId);
      if (!run) {
        throw new AppError('not_found', 'run_not_found', `Run ${runId} was not found.`);
      }
      return;
    }

    exec.markCancelled();
    if (exec.activeLoadgen && exec.activeLoadgen.isRunning()) {
      await exec.activeLoadgen.forceKill().catch(() => undefined);
    }
    if (exec.donePromise) {
      await exec.donePromise.catch(() => undefined);
    }
  }

  subscribe(runId: RunId, listener: (event: RunEvent) => void): () => void {
    return this.broadcaster.subscribe(runId, listener);
  }

  isBusy(): boolean {
    return this.lock.isLocked();
  }

  async forceReset(): Promise<void> {
    for (const [runId, exec] of this.activeExecutions) {
      exec.markCancelled();
      if (exec.activeLoadgen && exec.activeLoadgen.isRunning()) {
        await exec.activeLoadgen.forceKill().catch(() => undefined);
      }
      if (exec.activeSandbox) {
        await exec.activeSandbox.stop().catch(() => undefined);
      }
      this.runs.updateRunStatus(runId, 'cancelled', {
        finishedAt: new Date().toISOString(),
        errorMessage: 'Simulation was reset by user.',
      });
      const event: RunEvent = {
        runId,
        sequence: 999999,
        timestampMs: Date.now(),
        type: 'experiment_cancelled',
        payload: { reason: 'Simulation forcefully reset by user' },
      };
      this.runs.appendEvent(event);
      this.broadcaster.broadcast(event);
    }
    this.activeExecutions.clear();
    await this.chaos.teardown().catch(() => undefined);
    this.lock.forceRelease();
  }

  private async executeExperiment(
    runId: RunId,
    request: StartExperimentRequest,
    exec: ActiveExecution,
  ): Promise<void> {
    let sequence = 0;

    const emit = (type: RunEventType, payload: Record<string, unknown>) => {
      const event: RunEvent = {
        runId,
        sequence: sequence++,
        timestampMs: Date.now(),
        type,
        payload,
      };
      this.runs.appendEvent(event);
      this.broadcaster.broadcast(event);
    };

    emit('experiment_started', {
      topologyId: request.topology.id,
      faultCount: request.faults.length,
      invariantCount: request.invariants.length,
      trials: request.trialConfig.trials,
    });

    try {
      const plan = this.sandbox.allocateNetworkPlan(request.topology, {
        baseNodePort: 24000,
        baseProxyPort: 28010,
      });

      const edgeTargets = new Map<string, number>();
      for (const edge of request.topology.edges) {
        const targetAlloc = plan.nodes.find((n) => n.nodeId === edge.target);
        if (targetAlloc) {
          edgeTargets.set(edge.id, targetAlloc.port);
        }
      }

      await this.chaos.createProxiesForPlan(plan, edgeTargets);

      const sandbox = await this.sandbox.startSandbox(request.topology, plan, {
        useProxies: true,
      });
      exec.activeSandbox = sandbox;

      emit('sandbox_ready', {
        nodeCount: plan.nodes.length,
        proxyCount: plan.edges.length,
      });

      const entryNode = sandbox.configs.get(request.topology.entry.nodeId);
      if (!entryNode) {
        throw new AppError(
          'validation',
          'entry_node_missing',
          `Entry node ${request.topology.entry.nodeId} not found in sandbox configuration.`,
        );
      }

      const targetUrl = `http://${entryNode.listenHost}:${String(entryNode.listenPort)}/request`;

      const nodeMaxWorkers = new Map<string, number>();
      for (const node of request.topology.nodes) {
        nodeMaxWorkers.set(node.id, node.concurrency.maxWorkers);
      }
      const edgeIds = request.topology.edges.map((e) => e.id);

      // --- 1. Baseline Trials ---
      const baselineTrials: TrialResult[] = [];
      for (let i = 0; i < request.trialConfig.trials; i += 1) {
        if (exec.isCancelled()) {
          throw new CancelledError();
        }

        const seed = request.trialConfig.seed + i;
        emit('trial_started', { phase: 'baseline', trialIndex: i, seed });

        const startCounters = await sandbox.readCounters();
        const loadConfig: LoadgenConfig = {
          targetUrl,
          arrivalProcess: request.trialConfig.arrivalProcess,
          arrivalRateRps: request.trialConfig.arrivalRateRps,
          warmupDurationMs: request.trialConfig.warmupMs,
          measurementDurationMs: request.trialConfig.measurementMs,
          cooldownDurationMs: request.trialConfig.cooldownMs,
          clientTimeoutMs: request.trialConfig.clientTimeoutMs,
          seed,
          requestIdPrefix: `b${String(i)}`,
          method: 'POST',
        };

        const loadgen = await this.sandbox.startLoadgen(loadConfig);
        exec.activeLoadgen = loadgen;
        const loadResult = await loadgen.waitForCompletion();
        exec.activeLoadgen = null;

        const endCounters = await sandbox.readCounters();
        const series = await sandbox.readSeries();
        const baselineDelays = await sandbox.readDelays();

        const trial = this.measurement.buildTrialResult({
          trialIndex: i,
          seed,
          records: loadResult.records,
          startCounters,
          endCounters,
          workerSeries: series,
          workerEventLoopDelays: baselineDelays,
          nodeMaxWorkers,
          edgeIds,
          loadgenSummary: loadResult.summary,
        });

        await sandbox.resetCounters();

        this.runs.appendTrial(runId, 'baseline', trial);
        baselineTrials.push(trial);

        if (trial.validity.valid) {
          emit('trial_finished', {
            phase: 'baseline',
            trialIndex: i,
            completionRate: trial.metrics.completionRate,
            p99LatencyMs: trial.metrics.p99LatencyMs,
          });
        } else {
          emit('trial_invalid', {
            phase: 'baseline',
            trialIndex: i,
            reason: trial.validity.reason,
          });
        }
      }

      const baselineAggregate = this.measurement.aggregateTrials(baselineTrials);

      if (exec.isCancelled()) {
        throw new CancelledError();
      }

      // --- 2. Apply Faults ---
      for (const fault of request.faults) {
        await this.chaos.applyFault(fault);
        emit('fault_applied', {
          faultId: fault.id,
          type: fault.type,
          edgeId: fault.edgeId,
          direction: fault.direction,
        });
      }

      // --- 3. Faulted Trials ---
      const faultedTrials: TrialResult[] = [];
      for (let i = 0; i < request.trialConfig.trials; i += 1) {
        if (exec.isCancelled()) {
          throw new CancelledError();
        }

        const seed = request.trialConfig.seed + 1000 + i;
        emit('trial_started', { phase: 'faulted', trialIndex: i, seed });

        const startCounters = await sandbox.readCounters();
        const loadConfig: LoadgenConfig = {
          targetUrl,
          arrivalProcess: request.trialConfig.arrivalProcess,
          arrivalRateRps: request.trialConfig.arrivalRateRps,
          warmupDurationMs: request.trialConfig.warmupMs,
          measurementDurationMs: request.trialConfig.measurementMs,
          cooldownDurationMs: request.trialConfig.cooldownMs,
          clientTimeoutMs: request.trialConfig.clientTimeoutMs,
          seed,
          requestIdPrefix: `f${String(i)}`,
          method: 'POST',
        };

        const loadgen = await this.sandbox.startLoadgen(loadConfig);
        exec.activeLoadgen = loadgen;
        const loadResult = await loadgen.waitForCompletion();
        exec.activeLoadgen = null;

        const endCounters = await sandbox.readCounters();
        const series = await sandbox.readSeries();
        const faultedDelays = await sandbox.readDelays();

        const trial = this.measurement.buildTrialResult({
          trialIndex: i,
          seed,
          records: loadResult.records,
          startCounters,
          endCounters,
          workerSeries: series,
          workerEventLoopDelays: faultedDelays,
          nodeMaxWorkers,
          edgeIds,
          loadgenSummary: loadResult.summary,
        });

        await sandbox.resetCounters();

        this.runs.appendTrial(runId, 'faulted', trial);
        faultedTrials.push(trial);

        if (trial.validity.valid) {
          emit('trial_finished', {
            phase: 'faulted',
            trialIndex: i,
            completionRate: trial.metrics.completionRate,
            p99LatencyMs: trial.metrics.p99LatencyMs,
          });
        } else {
          emit('trial_invalid', {
            phase: 'faulted',
            trialIndex: i,
            reason: trial.validity.reason,
          });
        }
      }

      const faultedAggregate = this.measurement.aggregateTrials(faultedTrials);

      // --- 4. Evaluate Invariant Verdicts ---
      const verdicts = request.invariants.map((invariant) =>
        this.measurement.evaluateInvariantVerdict({
          invariant,
          baselineAggregate,
          faultedAggregate,
          baselineTrials,
          faultedTrials,
        }),
      );

      const overallStatus = this.measurement.computeOverallStatus(verdicts);

      emit('experiment_finished', {
        overallStatus,
        verdicts: verdicts.map((v) => ({
          invariantId: v.invariantId,
          status: v.status,
          reason: v.reason,
        })),
      });

      this.runs.updateRunStatus(runId, 'completed', {
        finishedAt: new Date().toISOString(),
        baselineAggregate,
        faultedAggregate,
        verdicts,
        overallStatus,
      });
    } catch (err: unknown) {
      const isCancelled = exec.isCancelled() || err instanceof CancelledError;

      const finishedAt = new Date().toISOString();
      if (isCancelled) {
        emit('experiment_cancelled', { reason: 'User cancellation' });
        this.runs.updateRunStatus(runId, 'cancelled', {
          finishedAt,
          errorMessage: 'Experiment was cancelled by user.',
        });
      } else {
        const errorMsg = err instanceof Error ? err.message : String(err);
        emit('experiment_failed', { error: errorMsg });
        this.runs.updateRunStatus(runId, 'failed', {
          finishedAt,
          errorMessage: errorMsg,
        });
      }
    } finally {
      if (exec.activeLoadgen && exec.activeLoadgen.isRunning()) {
        await exec.activeLoadgen.forceKill().catch(() => undefined);
      }
      await this.chaos.teardown().catch(() => undefined);
      if (exec.activeSandbox) {
        await exec.activeSandbox.stop().catch(() => undefined);
      }
      this.lock.release(runId);
      this.activeExecutions.delete(runId);
    }
  }
}
