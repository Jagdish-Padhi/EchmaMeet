import type { FastifyInstance } from 'fastify';
import { runIdSchema } from '@chaosboard/contracts';
import { AppError } from '@chaosboard/shared';
import type { RunsService } from '../application/runs-service';

export function registerRunsRoutes(app: FastifyInstance, runsService: RunsService): void {
  app.get('/api/runs', (request) => {
    const query = request.query as { limit?: string } | undefined;
    const limit = query?.limit ? Number(query.limit) : 50;
    return runsService.listRuns(Number.isFinite(limit) ? limit : 50);
  });

  app.get('/api/runs/:id', (request) => {
    const params = request.params as { id: string };
    const id = runIdSchema.parse(params.id);
    const run = runsService.getRun(id);
    if (!run) {
      throw new AppError('not_found', 'run_not_found', `Run ${id} was not found.`);
    }
    return run;
  });

  app.get('/api/runs/:id/events', (request) => {
    const params = request.params as { id: string };
    const id = runIdSchema.parse(params.id);
    const run = runsService.getRun(id);
    if (!run) {
      throw new AppError('not_found', 'run_not_found', `Run ${id} was not found.`);
    }
    return runsService.getEvents(id);
  });

  app.get('/api/runs/:id/export', (request, reply) => {
    const params = request.params as { id: string };
    const id = runIdSchema.parse(params.id);
    const run = runsService.getRun(id);
    if (!run) {
      throw new AppError('not_found', 'run_not_found', `Run ${id} was not found.`);
    }
    void reply.header('content-disposition', `attachment; filename="${id}.json"`);
    return run;
  });
}
