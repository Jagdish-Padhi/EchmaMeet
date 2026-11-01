import { execSync } from 'node:child_process';
import { cpus, platform } from 'node:os';
import { createChaosService } from '../modules/chaos';
import { createExperimentOrchestrator } from '../modules/experiments';
import { createMeasurementService } from '../modules/measurement';
import { OpenAiCompatibleAdapter } from '../modules/meta-ai';
import { createRepairOrchestrator } from '../modules/repair';
import { createRunsService } from '../modules/runs';
import { createBenchmarkModule } from '../modules/benchmarks';
import { moduleMigrations } from '../module-migrations';
import { loadSettings } from '../platform/config';
import { openDatabase, IN_MEMORY } from '../platform/db';
import { runMigrations } from '../platform/migrations';
import { systemClock } from '../platform/system-clock';

function getGitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let scenarioFilter: string | undefined;
  let predictOnly = false;
  let measureOnly = false;
  let predictionsPerScenario = 1;

  for (const arg of args) {
    if (arg.startsWith('--scenario=')) {
      scenarioFilter = arg.split('=')[1];
    } else if (arg === '--predict-only') {
      predictOnly = true;
    } else if (arg === '--measure-only') {
      measureOnly = true;
    } else if (arg.startsWith('--k=')) {
      predictionsPerScenario = parseInt(arg.split('=')[1] ?? '1', 10);
    }
  }

  const settings = loadSettings(process.env);
  const database = openDatabase(IN_MEMORY);
  runMigrations(database, moduleMigrations, systemClock);

  const runsService = createRunsService(database);
  const chaosService = createChaosService(settings.toxiproxyUrl, {
    upstreamHost: 'host.docker.internal',
  });
  const measurementService = createMeasurementService();
  const experimentOrchestrator = createExperimentOrchestrator({
    runs: runsService,
    chaos: chaosService,
    measurement: measurementService,
  });

  const modelClient = new OpenAiCompatibleAdapter({
    baseUrl: settings.partnerBaseUrl,
    apiKey: settings.partnerApiKey,
    modelId: settings.partnerModelId,
  });

  const repairOrchestrator = createRepairOrchestrator({
    experiments: experimentOrchestrator,
    runs: runsService,
    model: modelClient,
  });

  const benchmarks = createBenchmarkModule({
    experiments: experimentOrchestrator,
    runs: runsService,
    model: modelClient,
    repairOrchestrator,
  });

  const gitCommit = getGitCommit();
  const cpuList = cpus();
  const cpuModel = cpuList[0]?.model ?? 'CPU';
  const hostDescription = `${platform()} (${cpuModel}, ${String(cpuList.length)} cores)`;

  process.stdout.write(`Starting EchmaMeet Benchmark Suite...\n`);
  process.stdout.write(`Git Commit: ${gitCommit}\n`);
  process.stdout.write(`Host: ${hostDescription}\n`);
  if (scenarioFilter) {
    process.stdout.write(`Filter: Scenario ${scenarioFilter}\n`);
  }

  const summary = await benchmarks.runner.runSuite({
    scenarioFilter,
    predictOnly,
    measureOnly,
    predictionsPerScenario,
    gitCommit,
    hostDescription,
    nodeVersion: process.version,
  });

  process.stdout.write(`\n=== Benchmark Suite Complete ===\n`);
  process.stdout.write(`Evaluated: ${String(summary.results.length)} scenarios\n`);
  process.stdout.write(`Static Accuracy: ${String(summary.aggregateMetrics.staticAccuracyPct)}%\n`);
  process.stdout.write(
    `Model Repair Success: ${String(summary.aggregateMetrics.modelRepairSuccessPct)}%\n`,
  );
  process.stdout.write(
    `Rule Repair Success: ${String(summary.aggregateMetrics.ruleBasedRepairSuccessPct)}%\n`,
  );
  process.stdout.write(`Report generated at docs/benchmark-results.md\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `Benchmark failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(1);
});
