import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { VoiceLedgerPort } from '../application/ports';

const historyQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(25) });

export function registerVoiceLedgerRoutes(app: FastifyInstance, ledger: VoiceLedgerPort): void {
  app.get('/api/voice/history', async (request, reply) => {
    const { limit } = historyQuery.parse(request.query);
    return reply.send({ backend: ledger.backend, entries: await ledger.recent(limit) });
  });
  app.get('/api/voice/analytics', async (_request, reply) =>
    reply.send({ backend: ledger.backend, ...(await ledger.analytics()) }),
  );
}
