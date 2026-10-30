import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { registerTopologyRoutes } from './modules/topology';
import type { SqlDatabase } from './platform/db';
import { registerHealthRoute } from './platform/health';
import { registerProblemHandlers } from './platform/http-kit';
import type { Logger } from './platform/logging';

export interface AppDependencies {
  readonly logger: Logger;
  readonly database: SqlDatabase;
}

/**
 * Composition root for the HTTP application. This is where modules are mounted; modules never
 * mount themselves and never import each other's internals.
 */
export function buildApp({ logger, database }: AppDependencies): FastifyInstance {
  const baseLogger: FastifyBaseLogger = logger;
  const app = Fastify({ loggerInstance: baseLogger });
  registerProblemHandlers(app);

  registerHealthRoute(app, database);
  registerTopologyRoutes(app);
  return app;
}
