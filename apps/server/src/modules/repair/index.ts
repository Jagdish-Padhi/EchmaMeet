import { RepairOrchestrator } from './application/repair-orchestrator';
import { ModelRepairProposer } from './application/proposers/model-proposer';
import { RuleBasedRepairProposer } from './application/proposers/rule-based-proposer';
import { MLRandomForestRepairProposer } from './application/proposers/ml-proposer';
import { registerRepairRoutes } from './http/routes';
import { EventBroadcaster, type ExperimentOrchestrator } from '../experiments';
import type { RunsService } from '../runs';
import type { StructuredModelPort } from '../reasoning';

import { MLDiagnosisService } from './application/ml-diagnosis-service';

export {
  RepairOrchestrator,
  ModelRepairProposer,
  RuleBasedRepairProposer,
  MLRandomForestRepairProposer,
  MLDiagnosisService,
  registerRepairRoutes,
};

export interface CreateRepairOrchestratorDependencies {
  experiments: ExperimentOrchestrator;
  runs: RunsService;
  model?: StructuredModelPort | undefined;
  broadcaster?: EventBroadcaster | undefined;
}

export function createRepairOrchestrator(
  deps: CreateRepairOrchestratorDependencies,
): RepairOrchestrator {
  const broadcaster = deps.broadcaster ?? new EventBroadcaster();
  const modelProposer = deps.model ? new ModelRepairProposer(deps.model) : undefined;
  const ruleBasedProposer = new RuleBasedRepairProposer();
  const mlProposer = new MLRandomForestRepairProposer();

  return new RepairOrchestrator({
    experiments: deps.experiments,
    runs: deps.runs,
    modelProposer,
    ruleBasedProposer,
    mlProposer,
    broadcaster,
  });
}
