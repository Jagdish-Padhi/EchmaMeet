import { RepairOrchestrator } from './application/repair-orchestrator';
import { ModelRepairProposer } from './application/proposers/model-proposer';
import { RuleBasedRepairProposer } from './application/proposers/rule-based-proposer';
import { MLRandomForestRepairProposer } from './application/proposers/ml-proposer';
import { registerRepairRoutes } from './http/routes';
import { EventBroadcaster, type ExperimentOrchestrator } from '../experiments';
import type { RunsService } from '../runs';
import type { StructuredModelPort } from '../meta-ai';

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
  model: StructuredModelPort;
  broadcaster?: EventBroadcaster | undefined;
  resolveToxiproxyVersion?: (() => Promise<string>) | undefined;
}

export function createRepairOrchestrator(
  deps: CreateRepairOrchestratorDependencies,
): RepairOrchestrator {
  const broadcaster = deps.broadcaster ?? new EventBroadcaster();
  const modelProposer = new ModelRepairProposer(deps.model);
  const ruleBasedProposer = new RuleBasedRepairProposer();
  const mlProposer = new MLRandomForestRepairProposer();

  return new RepairOrchestrator({
    experiments: deps.experiments,
    runs: deps.runs,
    modelProposer,
    ruleBasedProposer,
    resolveToxiproxyVersion: deps.resolveToxiproxyVersion,
    mlProposer,
    broadcaster,
  });
}
