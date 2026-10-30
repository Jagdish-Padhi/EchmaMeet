import type { FastifyInstance } from 'fastify';
import { runIdSchema, startRepairRequestSchema, type RunEvent } from '@chaosboard/contracts';
import { openEventStream, parseWith } from '../../../platform/http-kit';
import type { RepairOrchestratorPort } from '../application/ports';
import type { RunsService } from '../../runs';

export function registerRepairRoutes(
  app: FastifyInstance,
  orchestrator: RepairOrchestratorPort,
  runs: RunsService,
): void {
  // POST /api/repairs
  app.post('/api/repairs', async (req, reply) => {
    const parsed = parseWith(startRepairRequestSchema, req.body, 'start repair request');
    const repairId = await orchestrator.start(parsed);
    return reply.status(201).send({
      repairId,
      status: 'running',
    });
  });

  // GET /api/repairs/:id
  app.get('/api/repairs/:id', (req, reply) => {
    const { id } = req.params as { id: string };
    const repairId = runIdSchema.parse(id);
    const session = orchestrator.getRepair(repairId);
    if (!session) {
      return reply.status(404).send({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: `Repair session ${repairId} was not found.`,
        code: 'repair_not_found',
      });
    }
    return reply.send(session);
  });

  // POST /api/repairs/:id/cancel
  app.post('/api/repairs/:id/cancel', async (req, reply) => {
    const { id } = req.params as { id: string };
    const repairId = runIdSchema.parse(id);
    await orchestrator.cancel(repairId);
    return reply.send({
      repairId,
      status: 'cancelling',
    });
  });

  // GET /api/repairs/:id/events
  app.get('/api/repairs/:id/events', (req, reply) => {
    const { id } = req.params as { id: string };
    const repairId = runIdSchema.parse(id);

    const stream = openEventStream(reply);

    // Stream historical events first
    const historical = runs.getEvents(repairId);
    let lastSeq = -1;
    for (const ev of historical) {
      stream.send({
        id: String(ev.sequence),
        event: ev.type,
        data: ev,
      });
      lastSeq = Math.max(lastSeq, ev.sequence);

      if (
        ev.type === 'repair_finished' ||
        ev.type === 'repair_failed' ||
        ev.type === 'repair_cancelled'
      ) {
        stream.close();
        return;
      }
    }

    const unsubscribe = orchestrator.subscribe(repairId, (event: RunEvent) => {
      if (event.sequence > lastSeq) {
        lastSeq = event.sequence;
        stream.send({
          id: String(event.sequence),
          event: event.type,
          data: event,
        });

        if (
          event.type === 'repair_finished' ||
          event.type === 'repair_failed' ||
          event.type === 'repair_cancelled'
        ) {
          unsubscribe();
          stream.close();
        }
      }
    });

    req.raw.on('close', () => {
      unsubscribe();
    });
  });
}
