import type { FastifyInstance } from 'fastify';
import { validateTopologyInput } from '../application/validate-topology';

export function registerTopologyRoutes(app: FastifyInstance): void {
  app.post('/api/topologies/validate', (request) => validateTopologyInput(request.body));
}
