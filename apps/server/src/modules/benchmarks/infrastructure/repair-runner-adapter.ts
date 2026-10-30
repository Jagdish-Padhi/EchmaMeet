import type { RepairOutcomeSummary, RunId, ScenarioSpec } from '@chaosboard/contracts';
import type { RepairOrchestrator } from '../../repair';
import type { RepairRunnerPort } from '../application/ports';

export class RepairRunnerAdapter implements RepairRunnerPort {
  constructor(private readonly repairOrchestrator: RepairOrchestrator) {}

  async runRepair(
    scenario: ScenarioSpec,
    _runId: RunId,
    proposerKind: 'rule_based' | 'model',
  ): Promise<RepairOutcomeSummary> {
    const repairId = await this.repairOrchestrator.start({
      topology: scenario.topology,
      faults: scenario.faults,
      invariants: scenario.invariants,
      trialConfig: scenario.trialConfig,
      proposer: proposerKind,
      maxIterations: 4,
      timeoutMs: 300000,
    });

    const deadlineMs = Date.now() + 300_000;
    while (Date.now() < deadlineMs) {
      const session = this.repairOrchestrator.getRepair(repairId);
      if (session && session.status !== 'running') {
        const iterationsCount = session.iterations.length;
        const patchCount = session.iterations.filter((it) => it.patch !== null).length;

        let promptTokens = 0;
        let completionTokens = 0;
        let hasTokens = false;

        for (const it of session.iterations) {
          const counts = it.modelCallMetadata?.tokenCounts;
          if (counts) {
            if (typeof counts.promptTokens === 'number') {
              hasTokens = true;
              promptTokens += counts.promptTokens;
            }
            if (typeof counts.completionTokens === 'number') {
              hasTokens = true;
              completionTokens += counts.completionTokens;
            }
          }
        }

        const statusMap: Record<
          string,
          'repaired' | 'trade_off_reached' | 'limits_reached' | 'failed'
        > = {
          repaired: 'repaired',
          trade_off_reached: 'trade_off_reached',
          limits_reached: 'limits_reached',
          failed: 'failed',
          cancelled: 'failed',
        };

        const status = statusMap[session.status] ?? 'failed';

        return {
          status,
          iterationsCount,
          patchCount,
          ...(hasTokens
            ? {
                totalTokens: {
                  promptTokens,
                  completionTokens,
                },
              }
            : {}),
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for repair session ${repairId} to finish`);
  }
}
