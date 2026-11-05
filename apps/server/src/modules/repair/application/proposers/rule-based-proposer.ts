import type { ProposeRepairParams, ProposeRepairResult, RepairProposerPort } from '../ports';
import { proposeBaselineRepair } from '../../domain/baseline-repairer';

export class RuleBasedRepairProposer implements RepairProposerPort {
  propose(params: ProposeRepairParams): Promise<ProposeRepairResult> {
    const { topology, record, iterationIndex } = params;
    const startNs = process.hrtime.bigint();

    const patch = proposeBaselineRepair(topology, record.verdicts, iterationIndex);
    const elapsedMs = Math.round(Number(process.hrtime.bigint() - startNs) / 1e6);

    return Promise.resolve({
      patch,
      rawOutput: patch ? JSON.stringify(patch) : null,
      metadata: {
        provider: 'rule_based',
        modelId: 'symptom-heuristics-v1',
        promptVersion: 'rules-v1',
        latencyMs: elapsedMs,
      },
    });
  }
}
