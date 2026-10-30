import type {
  BenchmarkSuiteSummary,
  InvariantVerdict,
  RepairOutcomeSummary,
  RunId,
  ScenarioId,
  ScenarioSpec,
  StaticPrediction,
  VerdictStatus,
} from '@chaosboard/contracts';

export interface ScenarioRepositoryPort {
  listScenarios(): Promise<readonly ScenarioSpec[]>;
  getScenario(id: ScenarioId): Promise<ScenarioSpec | null>;
}

export interface BenchmarkPersistencePort {
  savePredictions(scenarioId: ScenarioId, predictions: readonly StaticPrediction[]): Promise<void>;
  loadPredictions(scenarioId: ScenarioId): Promise<readonly StaticPrediction[]>;
  saveSuiteSummary(summary: BenchmarkSuiteSummary): Promise<void>;
  loadSuiteSummary(): Promise<BenchmarkSuiteSummary | null>;
  writeReportMarkdown(markdown: string): Promise<void>;
}

export interface StaticPredictorPort {
  predict(scenario: ScenarioSpec, index: number): Promise<StaticPrediction>;
}

export interface EmpiricalRunResult {
  runId: RunId;
  verdicts: InvariantVerdict[];
  overallStatus: VerdictStatus;
  p99LatencyMs: number | null;
  errorRate: number | null;
}

export interface ExperimentRunnerPort {
  runExperiment(scenario: ScenarioSpec): Promise<EmpiricalRunResult>;
}

export interface RepairRunnerPort {
  runRepair(
    scenario: ScenarioSpec,
    runId: RunId,
    proposerKind: 'rule_based' | 'model',
  ): Promise<RepairOutcomeSummary>;
}
