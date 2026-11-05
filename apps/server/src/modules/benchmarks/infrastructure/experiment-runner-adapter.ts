import type { ScenarioSpec } from '@chaosboard/contracts';
import type { ExperimentOrchestratorPort } from '../../experiments';
import type { RunsService } from '../../runs';
import type { EmpiricalRunResult, ExperimentRunnerPort } from '../application/ports';

export class ExperimentRunnerAdapter implements ExperimentRunnerPort {
  constructor(
    private readonly experiments: ExperimentOrchestratorPort,
    private readonly runs: RunsService,
  ) {}

  async runExperiment(scenario: ScenarioSpec): Promise<EmpiricalRunResult> {
    // Ensure host is not busy
    while (this.experiments.isBusy()) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const runId = await this.experiments.start({
      topology: scenario.topology,
      faults: scenario.faults,
      invariants: scenario.invariants,
      trialConfig: scenario.trialConfig,
    });

    // Wait for experiment completion
    const deadlineMs = Date.now() + 180_000;
    while (Date.now() < deadlineMs) {
      const record = this.runs.getRun(runId);
      if (record && record.status !== 'running') {
        const busyDeadline = Date.now() + 30_000;
        while (this.experiments.isBusy() && Date.now() < busyDeadline) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        const overallStatus = record.overallStatus ?? 'INVALID';
        const verdicts = record.verdicts;
        const p99LatencyMs = record.faultedAggregate?.metrics.p99LatencyMs.median ?? null;
        const completionRate = record.faultedAggregate?.metrics.completionRate.median ?? null;
        const errorRate = completionRate !== null ? Number((1 - completionRate).toFixed(4)) : null;

        return {
          runId,
          verdicts,
          overallStatus,
          p99LatencyMs,
          errorRate,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for experiment run ${runId} to finish`);
  }
}
