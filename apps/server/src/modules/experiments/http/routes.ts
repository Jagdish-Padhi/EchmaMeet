import type { FastifyInstance } from 'fastify';
import { runIdSchema, startExperimentRequestSchema } from '@chaosboard/contracts';
import { AppError } from '@chaosboard/shared';
import { openEventStream, parseWith } from '../../../platform/http-kit';
import type { ExperimentOrchestratorPort, RunsPort } from '../application/ports';

export function registerExperimentRoutes(
  app: FastifyInstance,
  orchestrator: ExperimentOrchestratorPort,
  runs: RunsPort,
): void {
  app.post('/api/experiments', async (request, reply) => {
    const input = parseWith(startExperimentRequestSchema, request.body, 'experiment request');
    const runId = await orchestrator.start(input);
    return reply.status(201).send({ runId });
  });

  app.get('/api/experiments/:id', async (request) => {
    const params = request.params as { id: string };
    const runId = runIdSchema.parse(params.id);
    const run = runs.getRun(runId);
    if (!run) {
      throw new AppError('not_found', 'run_not_found', `Run ${runId} was not found.`);
    }
    return run;
  });

  app.post('/api/experiments/:id/cancel', async (request) => {
    const params = request.params as { id: string };
    const runId = runIdSchema.parse(params.id);
    await orchestrator.cancel(runId);
    return { runId, status: 'cancelled' };
  });

  app.post('/api/experiments/reset-lock', async (_request, reply) => {
    await orchestrator.forceReset();
    return reply.status(200).send({
      status: 'ok',
      message: 'Host execution lock released successfully.',
    });
  });

  app.get('/api/experiments/:id/events', (request, reply) => {
    const params = request.params as { id: string };
    const runId = runIdSchema.parse(params.id);

    const stream = openEventStream(reply);

    // 1. Replay historical events
    const historical = runs.getEvents(runId);
    let lastSeq = -1;
    for (const event of historical) {
      stream.send({
        id: String(event.sequence),
        event: event.type,
        data: event,
      });
      lastSeq = Math.max(lastSeq, event.sequence);

      if (
        event.type === 'experiment_finished' ||
        event.type === 'experiment_failed' ||
        event.type === 'experiment_cancelled'
      ) {
        stream.close();
        return;
      }
    }

    // 2. Subscribe to live events
    const unsubscribe = orchestrator.subscribe(runId, (event) => {
      if (event.sequence > lastSeq) {
        stream.send({
          id: String(event.sequence),
          event: event.type,
          data: event,
        });
        lastSeq = event.sequence;

        if (
          event.type === 'experiment_finished' ||
          event.type === 'experiment_failed' ||
          event.type === 'experiment_cancelled'
        ) {
          unsubscribe();
          stream.close();
        }
      }
    });

    void stream.closed.then(() => {
      unsubscribe();
    });
  });
}
