import { RepairOrchestrator } from './application/repair-orchestrator';
import { ModelRepairProposer } from './application/proposers/model-proposer';
import { RuleBasedRepairProposer } from './application/proposers/rule-based-proposer';
import { registerRepairRoutes } from './http/routes';
import { EventBroadcaster, type ExperimentOrchestrator } from '../experiments';
import type { RunsService } from '../runs';
import type { StructuredModelPort } from '../meta-ai';

export { RepairOrchestrator, ModelRepairProposer, RuleBasedRepairProposer, registerRepairRoutes };

export interface CreateRepairOrchestratorDependencies {
  experiments: ExperimentOrchestrator;
  runs: RunsService;
  model: StructuredModelPort;
  broadcaster?: EventBroadcaster | undefined;
}

export function createRepairOrchestrator(
  deps: CreateRepairOrchestratorDependencies,
): RepairOrchestrator {
  const broadcaster = deps.broadcaster ?? new EventBroadcaster();
  const modelProposer = new ModelRepairProposer(deps.model);
  const ruleBasedProposer = new RuleBasedRepairProposer();

  return new RepairOrchestrator({
    experiments: deps.experiments,
    runs: deps.runs,
    modelProposer,
    ruleBasedProposer,
    broadcaster,
  });
}
