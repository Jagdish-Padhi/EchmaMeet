import type {
  BenchmarkComparison,
  BenchmarkSuiteSummary,
  ScenarioSpec,
  StaticPrediction,
} from '@chaosboard/contracts';
import { calculateAgreement, computeSuiteSummary } from '../domain/metrics';
import { generateBenchmarkReport } from '../domain/report-generator';
import type {
  BenchmarkPersistencePort,
  ExperimentRunnerPort,
  RepairRunnerPort,
  ScenarioRepositoryPort,
  StaticPredictorPort,
} from './ports';

export interface BenchmarkRunnerDeps {
  scenarios: ScenarioRepositoryPort;
  persistence: BenchmarkPersistencePort;
  predictor?: StaticPredictorPort | undefined;
  experimentRunner?: ExperimentRunnerPort | undefined;
  repairRunner?: RepairRunnerPort | undefined;
}

export interface RunSuiteOptions {
  scenarioFilter?: string | undefined;
  predictOnly?: boolean | undefined;
  measureOnly?: boolean | undefined;
  predictionsPerScenario?: number | undefined;
  gitCommit?: string | undefined;
  hostDescription?: string | undefined;
  nodeVersion?: string | undefined;
}

export class BenchmarkRunner {
  constructor(private readonly deps: BenchmarkRunnerDeps) {}

  async runSuite(options: RunSuiteOptions = {}): Promise<BenchmarkSuiteSummary> {
    const allScenarios = await this.deps.scenarios.listScenarios();
    const scenarios = options.scenarioFilter
      ? allScenarios.filter((s) => s.id === options.scenarioFilter)
      : allScenarios;

    const comparisons: BenchmarkComparison[] = [];
    const kPredictions = options.predictionsPerScenario ?? 1;

    for (const scenario of scenarios) {
      if (options.predictOnly) {
        if (this.deps.predictor) {
          const preds = await this.loadOrGeneratePredictions(scenario, kPredictions);
          comparisons.push({
            scenarioId: scenario.id,
            designedFailureMode: scenario.designedFailureMode,
            staticPredictions: preds,
            empiricalRun: undefined,
            repairComparisons: undefined,
            agreement: undefined,
          });
        }
        continue;
      }

      // 1. Static predictions
      const predictions = !options.measureOnly
        ? await this.loadOrGeneratePredictions(scenario, kPredictions)
        : await this.deps.persistence.loadPredictions(scenario.id);

      // 2. Empirical experiment
      if (!this.deps.experimentRunner) {
        throw new Error('ExperimentRunnerPort is required to run empirical benchmarks');
      }

      const empirical = await this.deps.experimentRunner.runExperiment(scenario);

      // 3. Repair comparisons if violated
      let repairComparisons: BenchmarkComparison['repairComparisons'] = undefined;

      if (empirical.overallStatus === 'VIOLATED' && this.deps.repairRunner) {
        const ruleOutcome = await this.deps.repairRunner.runRepair(
          scenario,
          empirical.runId,
          'rule_based',
        );
        const modelOutcome = await this.deps.repairRunner.runRepair(
          scenario,
          empirical.runId,
          'model',
        );

        repairComparisons = {
          ruleBased: ruleOutcome,
          model: modelOutcome,
        };
      }

      // 4. Compute agreement metrics
      const agreement = calculateAgreement(
        predictions,
        {
          runId: empirical.runId,
          verdicts: empirical.verdicts,
          overallStatus: empirical.overallStatus,
          p99LatencyMs: empirical.p99LatencyMs,
          errorRate: empirical.errorRate,
        },
        scenario.designedFailureMode,
      );

      const comparison: BenchmarkComparison = {
        scenarioId: scenario.id,
        designedFailureMode: scenario.designedFailureMode,
        staticPredictions: [...predictions],
        empiricalRun: {
          runId: empirical.runId,
          verdicts: empirical.verdicts,
          overallStatus: empirical.overallStatus,
          p99LatencyMs: empirical.p99LatencyMs,
          errorRate: empirical.errorRate,
        },
        ...(repairComparisons !== undefined ? { repairComparisons } : {}),
        agreement,
      };

      comparisons.push(comparison);
    }

    // 5. Suite summary and report generation
    const summary = computeSuiteSummary(comparisons, {
      generatedAt: new Date().toISOString(),
      gitCommit: options.gitCommit ?? 'unknown',
      hostDescription: options.hostDescription ?? process.platform,
      nodeVersion: options.nodeVersion ?? process.version,
    });

    await this.deps.persistence.saveSuiteSummary(summary);
    const reportMarkdown = generateBenchmarkReport(summary);
    await this.deps.persistence.writeReportMarkdown(reportMarkdown);

    return summary;
  }

  private async loadOrGeneratePredictions(
    scenario: ScenarioSpec,
    kPredictions: number,
  ): Promise<readonly StaticPrediction[]> {
    const loaded = await this.deps.persistence.loadPredictions(scenario.id);
    if (loaded.length > 0 || !this.deps.predictor) {
      return loaded;
    }
    const generated: StaticPrediction[] = [];
    for (let i = 0; i < kPredictions; i++) {
      const pred = await this.deps.predictor.predict(scenario, i);
      generated.push(pred);
    }
    await this.deps.persistence.savePredictions(scenario.id, generated);
    return generated;
  }
}
