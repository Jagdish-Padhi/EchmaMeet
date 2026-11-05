import type { FastifyInstance } from 'fastify';
import { scenarioIdSchema } from '@chaosboard/contracts';
import { parseWith } from '../../../platform/http-kit';
import type { BenchmarkPersistencePort, ScenarioRepositoryPort } from '../application/ports';

export function registerBenchmarkRoutes(
  app: FastifyInstance,
  scenarios: ScenarioRepositoryPort,
  persistence: BenchmarkPersistencePort,
): void {
  // GET /api/scenarios
  app.get('/api/scenarios', async (_req, reply) => {
    const list = await scenarios.listScenarios();
    return reply.send(list);
  });

  // GET /api/scenarios/:id
  app.get('/api/scenarios/:id', async (req, reply) => {
    const params = req.params as { id?: string };
    const parsedId = parseWith(scenarioIdSchema, params.id, 'scenario id');
    const scenario = await scenarios.getScenario(parsedId);
    if (!scenario) {
      return reply.status(404).send({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: `Scenario ${parsedId} was not found.`,
        code: 'scenario_not_found',
      });
    }
    return reply.send(scenario);
  });

  // GET /api/benchmarks/results
  app.get('/api/benchmarks/results', async (_req, reply) => {
    const summary = await persistence.loadSuiteSummary();
    if (!summary) {
      return reply.status(404).send({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Benchmark suite results have not been generated yet.',
        code: 'benchmark_results_not_found',
      });
    }
    return reply.send(summary);
  });
}
