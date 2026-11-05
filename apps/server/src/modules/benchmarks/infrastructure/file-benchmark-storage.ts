import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  benchmarkSuiteSummarySchema,
  staticPredictionSchema,
  type BenchmarkSuiteSummary,
  type ScenarioId,
  type ScenarioSpec,
  type StaticPrediction,
} from '@chaosboard/contracts';
import type { BenchmarkPersistencePort, ScenarioRepositoryPort } from '../application/ports';
import { parseScenarioSpec } from '../application/scenario-loader';

export class FileBenchmarkStorage implements ScenarioRepositoryPort, BenchmarkPersistencePort {
  constructor(
    private readonly scenariosDir: string,
    private readonly predictionsDir: string,
    private readonly resultsDir: string,
    private readonly reportPath: string,
  ) {
    if (!existsSync(this.scenariosDir)) {
      mkdirSync(this.scenariosDir, { recursive: true });
    }
    if (!existsSync(this.predictionsDir)) {
      mkdirSync(this.predictionsDir, { recursive: true });
    }
    if (!existsSync(this.resultsDir)) {
      mkdirSync(this.resultsDir, { recursive: true });
    }
    const reportDir = dirname(this.reportPath);
    if (!existsSync(reportDir)) {
      mkdirSync(reportDir, { recursive: true });
    }
  }

  listScenarios(): Promise<readonly ScenarioSpec[]> {
    if (!existsSync(this.scenariosDir)) {
      return Promise.resolve([]);
    }
    const files = readdirSync(this.scenariosDir).filter((f) => f.endsWith('.json'));
    const scenarios: ScenarioSpec[] = [];

    for (const file of files) {
      const fullPath = join(this.scenariosDir, file);
      const raw = JSON.parse(readFileSync(fullPath, 'utf8')) as unknown;
      scenarios.push(parseScenarioSpec(raw));
    }

    return Promise.resolve(scenarios.sort((a, b) => a.id.localeCompare(b.id)));
  }

  getScenario(id: ScenarioId): Promise<ScenarioSpec | null> {
    const filePath = join(this.scenariosDir, `${id}.json`);
    if (!existsSync(filePath)) {
      return Promise.resolve(null);
    }
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    return Promise.resolve(parseScenarioSpec(raw));
  }

  savePredictions(scenarioId: ScenarioId, predictions: readonly StaticPrediction[]): Promise<void> {
    const filePath = join(this.predictionsDir, `${scenarioId}.json`);
    writeFileSync(filePath, JSON.stringify(predictions, null, 2), 'utf8');
    return Promise.resolve();
  }

  loadPredictions(scenarioId: ScenarioId): Promise<readonly StaticPrediction[]> {
    const filePath = join(this.predictionsDir, `${scenarioId}.json`);
    if (!existsSync(filePath)) {
      return Promise.resolve([]);
    }
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    if (!Array.isArray(raw)) {
      return Promise.resolve([]);
    }
    return Promise.resolve(raw.map((item) => staticPredictionSchema.parse(item)));
  }

  saveSuiteSummary(summary: BenchmarkSuiteSummary): Promise<void> {
    const filePath = join(this.resultsDir, 'suite-summary.json');
    writeFileSync(filePath, JSON.stringify(summary, null, 2), 'utf8');
    return Promise.resolve();
  }

  loadSuiteSummary(): Promise<BenchmarkSuiteSummary | null> {
    const filePath = join(this.resultsDir, 'suite-summary.json');
    if (!existsSync(filePath)) {
      return Promise.resolve(null);
    }
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    return Promise.resolve(benchmarkSuiteSummarySchema.parse(raw));
  }

  writeReportMarkdown(markdown: string): Promise<void> {
    writeFileSync(this.reportPath, markdown, 'utf8');
    return Promise.resolve();
  }
}
