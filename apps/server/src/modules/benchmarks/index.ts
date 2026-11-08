import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ExperimentOrchestratorPort } from '../experiments';
import type { StructuredModelPort } from '../reasoning';
import type { RepairOrchestrator } from '../repair';
import type { RunsService } from '../runs';
import { BenchmarkRunner, type RunSuiteOptions } from './application/benchmark-runner';
import type {
  BenchmarkPersistencePort,
  ExperimentRunnerPort,
  RepairRunnerPort,
  ScenarioRepositoryPort,
  StaticPredictorPort,
} from './application/ports';
import { StaticPredictor } from './application/static-predictor';
import { calculateAgreement, computeSuiteSummary } from './domain/metrics';
import { generateBenchmarkReport } from './domain/report-generator';
import { ExperimentRunnerAdapter } from './infrastructure/experiment-runner-adapter';
import { FileBenchmarkStorage } from './infrastructure/file-benchmark-storage';
import { RepairRunnerAdapter } from './infrastructure/repair-runner-adapter';
import { registerBenchmarkRoutes } from './http/routes';

export {
  BenchmarkRunner,
  FileBenchmarkStorage,
  ExperimentRunnerAdapter,
  RepairRunnerAdapter,
  StaticPredictor,
  registerBenchmarkRoutes,
  calculateAgreement,
  computeSuiteSummary,
  generateBenchmarkReport,
};

export type {
  ScenarioRepositoryPort,
  BenchmarkPersistencePort,
  ExperimentRunnerPort,
  RepairRunnerPort,
  StaticPredictorPort,
  RunSuiteOptions,
};

export interface BenchmarkModuleOptions {
  workspaceRoot?: string | undefined;
  experiments?: ExperimentOrchestratorPort | undefined;
  runs?: RunsService | undefined;
  model?: StructuredModelPort | undefined;
  repairOrchestrator?: RepairOrchestrator | undefined;
}

function findWorkspaceRoot(startDir: string = process.cwd()): string {
  let curr = startDir;
  while (curr.length > 0) {
    if (existsSync(join(curr, 'pnpm-workspace.yaml'))) {
      return curr;
    }
    const parent = dirname(curr);
    if (parent === curr) {
      break;
    }
    curr = parent;
  }
  return startDir;
}

export function createBenchmarkModule(options: BenchmarkModuleOptions = {}): {
  storage: FileBenchmarkStorage;
  runner: BenchmarkRunner;
  registerRoutes: (app: FastifyInstance) => void;
} {
  const root = options.workspaceRoot ?? findWorkspaceRoot();
  const scenariosDir = join(root, 'benchmarks', 'scenarios');
  const predictionsDir = join(root, 'benchmarks', 'predictions');
  const resultsDir = join(root, 'benchmarks', 'results');
  const reportPath = join(root, 'docs', 'benchmark-results.md');

  const storage = new FileBenchmarkStorage(scenariosDir, predictionsDir, resultsDir, reportPath);

  const predictor = options.model ? new StaticPredictor(options.model) : undefined;
  const experimentRunner =
    options.experiments && options.runs
      ? new ExperimentRunnerAdapter(options.experiments, options.runs)
      : undefined;
  const repairRunner = options.repairOrchestrator
    ? new RepairRunnerAdapter(options.repairOrchestrator)
    : undefined;

  const runner = new BenchmarkRunner({
    scenarios: storage,
    persistence: storage,
    predictor,
    experimentRunner,
    repairRunner,
  });

  return {
    storage,
    runner,
    registerRoutes: (app: FastifyInstance) => {
      registerBenchmarkRoutes(app, storage, storage);
    },
  };
}
