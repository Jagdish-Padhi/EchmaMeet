import { randomUUID } from 'node:crypto';
import {
  runIdSchema,
  type InvariantVerdict,
  type RepairIterationRecord,
  type RepairSessionRecord,
  type RunEvent,
  type RunEventType,
  type RunId,
  type RunRecord,
  type StartRepairRequest,
  type Topology,
} from '@chaosboard/contracts';
import { AppError } from '@chaosboard/shared';
import type { EventBroadcasterPort, ExperimentOrchestratorPort } from '../../experiments';
import type { RunsService } from '../../runs';
import { applyRepairPatch } from '../domain/apply-patch';
import { evaluateRepairDecision } from '../domain/decision';
import { buildTelemetrySummary } from '../domain/summarizer';
import { buildTradeOffReport } from '../domain/trade-off-builder';
import { validateRepairPatch } from '../domain/validator';
import type { RepairOrchestratorPort, RepairProposerPort } from './ports';

function generateRepairId(): RunId {
  return runIdSchema.parse(`run-${randomUUID()}`);
}

interface ActiveRepairSession {
  isCancelled: () => boolean;
  markCancelled: () => void;
  controller: AbortController;
  currentExperimentRunId?: RunId | undefined;
  donePromise?: Promise<void> | undefined;
}

export interface RepairOrchestratorDependencies {
  experiments: ExperimentOrchestratorPort;
  runs: RunsService;
  modelProposer?: RepairProposerPort | undefined;
  ruleBasedProposer: RepairProposerPort;
  mlProposer?: RepairProposerPort | undefined;
  broadcaster: EventBroadcasterPort;
}

export class RepairOrchestrator implements RepairOrchestratorPort {
  private readonly sessions = new Map<RunId, RepairSessionRecord>();
  private readonly activeSessions = new Map<RunId, ActiveRepairSession>();

  constructor(private readonly deps: RepairOrchestratorDependencies) {}

  start(request: StartRepairRequest): Promise<RunId> {
    const repairId = generateRepairId();
    const now = new Date().toISOString();

    const sessionRecord: RepairSessionRecord = {
      id: repairId,
      status: 'running',
      startedAt: now,
      finishedAt: null,
      proposer: request.proposer,
      initialTopology: request.topology,
      bestTopology: request.topology,
      faults: request.faults,
      invariants: request.invariants,
      trialConfig: request.trialConfig,
      iterations: [],
      finalReport: null,
      errorMessage: null,
    };

    const initialRunRecord: RunRecord = {
      id: repairId,
      status: 'running',
      topology: request.topology,
      faults: request.faults,
      invariants: request.invariants,
      trialConfig: request.trialConfig,
      baselineAggregate: null,
      faultedAggregate: null,
      verdicts: [],
      overallStatus: null,
      provenance: {
        gitCommit: process.env['GIT_COMMIT'] ?? 'local',
        hostDescription: `${process.platform}-${process.arch}`,
        nodeVersion: process.version,
        toxiproxyVersion: '2.13.0',
        startedAt: now,
      },
      createdAt: now,
      finishedAt: null,
      errorMessage: null,
    };
    this.deps.runs.createRun(initialRunRecord);

    this.sessions.set(repairId, sessionRecord);

    let cancelled = false;
    const controller = new AbortController();
    const active: ActiveRepairSession = {
      isCancelled: () => cancelled,
      markCancelled: () => {
        cancelled = true;
        controller.abort();
      },
      controller,
    };
    this.activeSessions.set(repairId, active);

    const donePromise = this.executeRepair(repairId, request, active);
    active.donePromise = donePromise;

    return Promise.resolve(repairId);
  }

  getRepair(repairId: RunId): RepairSessionRecord | null {
    return this.sessions.get(repairId) ?? null;
  }

  async cancel(repairId: RunId): Promise<void> {
    const active = this.activeSessions.get(repairId);
    if (!active) {
      return;
    }
    active.markCancelled();
    if (active.currentExperimentRunId) {
      await this.deps.experiments.cancel(active.currentExperimentRunId).catch(() => undefined);
    }
    if (active.donePromise) {
      await active.donePromise.catch(() => undefined);
    }
  }

  subscribe(repairId: RunId, listener: (event: RunEvent) => void): () => void {
    return this.deps.broadcaster.subscribe(repairId, listener);
  }

  private async waitForRunCompletion(
    runId: RunId,
    deadlineMs: number,
    active: ActiveRepairSession,
  ): Promise<RunRecord> {
    while (Date.now() < deadlineMs) {
      if (active.isCancelled()) {
        await this.deps.experiments.cancel(runId).catch(() => undefined);
        throw new AppError('timeout', 'cancelled', 'Repair cancelled.');
      }
      const record = this.deps.runs.getRun(runId);
      if (
        record &&
        (record.status === 'completed' ||
          record.status === 'failed' ||
          record.status === 'cancelled')
      ) {
        while (this.deps.experiments.isBusy() && Date.now() < deadlineMs) {
          if (active.isCancelled()) break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return record;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new AppError(
      'timeout',
      'run_timeout',
      `Experiment ${runId} timed out awaiting completion.`,
    );
  }

  private async executeRepair(
    repairId: RunId,
    request: StartRepairRequest,
    active: ActiveRepairSession,
  ): Promise<void> {
    let sequence = 0;
    const emit = (type: RunEventType, payload: Record<string, unknown>) => {
      const event: RunEvent = {
        runId: repairId,
        sequence: sequence++,
        timestampMs: Date.now(),
        type,
        payload,
      };
      this.deps.runs.appendEvent(event);
      this.deps.broadcaster.broadcast(event);
    };

    emit('repair_started', {
      proposer: request.proposer,
      maxIterations: request.maxIterations,
      topologyId: request.topology.id,
    });

    const proposer =
      request.proposer === 'model'
        ? (this.deps.modelProposer ?? this.deps.mlProposer ?? this.deps.ruleBasedProposer)
        : request.proposer === 'ml_random_forest'
          ? (this.deps.mlProposer ?? this.deps.ruleBasedProposer)
          : this.deps.ruleBasedProposer;
    let currentTopology: Topology = request.topology;
    let bestTopology: Topology = request.topology;
    let latestVerdicts: readonly InvariantVerdict[];
    const iterations: RepairIterationRecord[] = [];

    const deadline = Date.now() + request.timeoutMs;

    try {
      // Step 0: Preflight checks on topology and faults
      if (!currentTopology.edges || currentTopology.edges.length === 0) {
        const reason =
          'Architecture topology has no connections. Connect at least two services to run resilience repair.';
        this.updateSession(repairId, {
          status: 'failed',
          errorMessage: reason,
          finishedAt: new Date().toISOString(),
        });
        emit('repair_finished', {
          status: 'failed',
          iterations: 0,
          reason,
        });
        return;
      }

      for (const fault of request.faults) {
        const edgeExists = currentTopology.edges.some((e) => e.id === fault.edgeId);
        if (!edgeExists) {
          const available = currentTopology.edges.map((e) => e.id).join(', ');
          const reason = `Fault targets connection "${fault.edgeId}" which does not exist in the diagram. Available connections: [${available}].`;
          this.updateSession(repairId, {
            status: 'failed',
            errorMessage: reason,
            finishedAt: new Date().toISOString(),
          });
          emit('repair_finished', {
            status: 'failed',
            iterations: 0,
            reason,
          });
          return;
        }
      }

      // Step 1: Run baseline experiment on initial topology
      const initialRunId = await this.deps.experiments.start({
        topology: currentTopology,
        faults: request.faults,
        invariants: request.invariants,
        trialConfig: request.trialConfig,
      });
      active.currentExperimentRunId = initialRunId;

      const initialRecord = await this.waitForRunCompletion(initialRunId, deadline, active);
      active.currentExperimentRunId = undefined;
      latestVerdicts = initialRecord.verdicts;

      if (initialRecord.status === 'failed' || initialRecord.overallStatus === 'INVALID') {
        const reason =
          initialRecord.errorMessage ||
          `Initial baseline simulation failed (status: ${initialRecord.status}, overallStatus: ${initialRecord.overallStatus ?? 'UNKNOWN'}). Baseline must be healthy before autonomous repair can proceed.`;
        this.updateSession(repairId, {
          status: 'failed',
          errorMessage: reason,
          finishedAt: new Date().toISOString(),
        });
        emit('repair_finished', {
          status: 'failed',
          iterations: 0,
          reason,
        });
        return;
      }

      const initialPassed =
        latestVerdicts.length > 0 && latestVerdicts.every((v) => v.status === 'PASS');
      if (initialPassed) {
        this.updateSession(repairId, {
          status: 'repaired',
          finishedAt: new Date().toISOString(),
          bestTopology: currentTopology,
        });
        emit('repair_finished', {
          status: 'repaired',
          iterations: 0,
          reason: 'Initial topology already satisfies all invariants.',
        });
        return;
      }

      let latestRecord: RunRecord = initialRecord;

      // Step 2: Loop iterations
      for (let i = 0; i < request.maxIterations; i += 1) {
        if (active.isCancelled() || Date.now() >= deadline) {
          break;
        }

        emit('repair_iteration_started', { iterationIndex: i });

        const summary = buildTelemetrySummary(currentTopology, latestRecord);
        const proposeRes = await proposer.propose({
          topology: currentTopology,
          record: latestRecord,
          invariants: request.invariants,
          iterationIndex: i,
          signal: active.controller.signal,
        });

        if (proposeRes.error) {
          const errorMsg = `Model proposer failed: ${proposeRes.error}`;
          this.updateSession(repairId, {
            status: 'failed',
            errorMessage: errorMsg,
            finishedAt: new Date().toISOString(),
          });
          emit('repair_finished', {
            status: 'failed',
            iterations: i,
            reason: errorMsg,
          });
          return;
        }

        if (!proposeRes.patch) {
          // Proposer could not propose any patch
          break;
        }

        emit('patch_proposed', {
          iterationIndex: i,
          operationsCount: proposeRes.patch.operations.length,
          hypothesis: proposeRes.patch.hypothesis,
        });

        // Validate patch
        const validation = validateRepairPatch(currentTopology, proposeRes.patch);
        if (!validation.valid) {
          emit('patch_rejected', {
            iterationIndex: i,
            reasons: validation.problems.map((p) => `${p.code}: ${p.message}`),
          });

          iterations.push({
            iterationIndex: i,
            summarySent: summary,
            rawModelOutput: proposeRes.rawOutput,
            patch: proposeRes.patch,
            validation,
            experimentRunId: null,
            verdicts: null,
            overallStatus: null,
            decision: 'rollback',
            decisionReason: 'Patch failed catalog boundary validation.',
            modelCallMetadata: proposeRes.metadata,
          });
          continue;
        }

        // Apply patch
        const candidateTopology = applyRepairPatch(currentTopology, proposeRes.patch);
        emit('patch_applied', { iterationIndex: i });

        // Run experiment with candidate topology
        const expRunId = await this.deps.experiments.start({
          topology: candidateTopology,
          faults: request.faults,
          invariants: request.invariants,
          trialConfig: request.trialConfig,
        });
        active.currentExperimentRunId = expRunId;

        const expRecord = await this.waitForRunCompletion(expRunId, deadline, active);
        active.currentExperimentRunId = undefined;
        const candidateVerdicts = expRecord.verdicts;

        emit('iteration_measured', {
          iterationIndex: i,
          overallStatus: expRecord.overallStatus,
        });

        // Decide: accept or rollback (INVALID runs are strictly rejected)
        const evaluation =
          expRecord.overallStatus === 'INVALID'
            ? {
                decision: 'rollback' as const,
                reason: `Rolled back: Candidate experiment ${expRunId} had INVALID status (${expRecord.errorMessage ?? 'invalid telemetry'}).`,
              }
            : evaluateRepairDecision(latestVerdicts, candidateVerdicts);

        if (evaluation.decision === 'accept') {
          currentTopology = candidateTopology;
          bestTopology = candidateTopology;
          latestVerdicts = candidateVerdicts;
          latestRecord = expRecord;
          emit('patch_accepted', {
            iterationIndex: i,
            reason: evaluation.reason,
          });
        } else {
          // Rollback to best
          currentTopology = bestTopology;
          emit('patch_rolled_back', {
            iterationIndex: i,
            reason: evaluation.reason,
          });
        }

        iterations.push({
          iterationIndex: i,
          summarySent: summary,
          rawModelOutput: proposeRes.rawOutput,
          patch: proposeRes.patch,
          validation,
          experimentRunId: expRunId,
          verdicts: candidateVerdicts,
          overallStatus: expRecord.overallStatus,
          decision: evaluation.decision,
          decisionReason: evaluation.reason,
          modelCallMetadata: proposeRes.metadata,
        });

        // Check if fully repaired
        const allPass =
          candidateVerdicts.length > 0 && candidateVerdicts.every((v) => v.status === 'PASS');
        if (allPass && evaluation.decision === 'accept') {
          this.updateSession(repairId, {
            status: 'repaired',
            finishedAt: new Date().toISOString(),
            bestTopology,
            iterations,
          });

          emit('repair_finished', {
            status: 'repaired',
            iterationsCount: iterations.length,
          });
          return;
        }
      }

      // If loop finished without reaching all-PASS: build TradeOffReport
      if (active.isCancelled()) {
        this.updateSession(repairId, {
          status: 'cancelled',
          finishedAt: new Date().toISOString(),
          bestTopology,
          iterations,
          errorMessage: 'Repair session cancelled by user.',
        });
        emit('repair_cancelled', { reason: 'User cancellation' });
        return;
      }

      const report = buildTradeOffReport(bestTopology, latestVerdicts, iterations);
      this.updateSession(repairId, {
        status: 'trade_off_reached',
        finishedAt: new Date().toISOString(),
        bestTopology,
        iterations,
        finalReport: report,
      });

      emit('repair_finished', {
        status: 'trade_off_reached',
        iterationsCount: iterations.length,
        bottleneckReason: report.bottleneckReason,
      });
    } catch (err: unknown) {
      if (active.isCancelled()) {
        this.updateSession(repairId, {
          status: 'cancelled',
          finishedAt: new Date().toISOString(),
          bestTopology,
          iterations,
          errorMessage: 'Repair session cancelled by user.',
        });
        emit('repair_cancelled', { reason: 'User cancellation' });
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.updateSession(repairId, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        bestTopology,
        iterations,
        errorMessage: msg,
      });
      emit('repair_failed', { error: msg });
    } finally {
      this.activeSessions.delete(repairId);
    }
  }

  private updateSession(repairId: RunId, updates: Partial<RepairSessionRecord>): void {
    const existing = this.sessions.get(repairId);
    if (existing) {
      this.sessions.set(repairId, { ...existing, ...updates });
    }
    if (updates.status) {
      const runStatus: RunRecord['status'] =
        updates.status === 'cancelled'
          ? 'cancelled'
          : updates.status === 'failed'
            ? 'failed'
            : 'completed';
      try {
        this.deps.runs.updateRunStatus(repairId, runStatus, {
          finishedAt: updates.finishedAt ?? new Date().toISOString(),
          errorMessage: updates.errorMessage ?? null,
        });
      } catch {
        // ignore
      }
    }
  }
}
