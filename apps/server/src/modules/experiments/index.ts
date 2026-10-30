import { ExperimentLock } from './domain/experiment-lock';
import { EventBroadcaster } from './infrastructure/event-broadcaster';
import { ExperimentOrchestrator } from './application/experiment-orchestrator';
import { registerExperimentRoutes } from './http/routes';
import type { RunsService } from '../runs';
import type { ChaosService } from '../chaos';
import type { MeasurementService } from '../measurement';
import * as sandboxModule from '../sandbox';
import * as measurementModule from '../measurement';

export { ExperimentLock, EventBroadcaster, ExperimentOrchestrator, registerExperimentRoutes };
export type { EventBroadcasterPort, ExperimentOrchestratorPort } from './application/ports';

export interface CreateExperimentOrchestratorDependencies {
  runs: RunsService;
  chaos: ChaosService;
  measurement: MeasurementService;
  lock?: ExperimentLock;
  broadcaster?: EventBroadcaster;
}

export function createExperimentOrchestrator(
  deps: CreateExperimentOrchestratorDependencies,
): ExperimentOrchestrator {
  const lock = deps.lock ?? new ExperimentLock();
  const broadcaster = deps.broadcaster ?? new EventBroadcaster();

  return new ExperimentOrchestrator(
    lock,
    broadcaster,
    deps.runs,
    deps.chaos,
    {
      allocateNetworkPlan: sandboxModule.allocateNetworkPlan,
      startSandbox: sandboxModule.startSandbox,
      startLoadgen: sandboxModule.startLoadgen,
    },
    {
      buildTrialResult: (p) => deps.measurement.buildTrialResult(p),
      aggregateTrials: (t) => deps.measurement.aggregateTrials(t),
      evaluateInvariantVerdict: (p) => measurementModule.evaluateInvariantVerdict(p),
      computeOverallStatus: (v) => measurementModule.computeOverallStatus(v),
    },
  );
}
