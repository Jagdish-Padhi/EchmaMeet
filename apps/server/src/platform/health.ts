import type { HealthResponse } from '@chaosboard/contracts';
import type { FastifyInstance } from 'fastify';
import type { SqlDatabase } from './db';

/** Reports real state: the database check runs an actual query on every request. */
export function registerHealthRoute(app: FastifyInstance, database: SqlDatabase): void {
  app.get('/api/health', (request): HealthResponse => {
    let databaseStatus: HealthResponse['checks']['database'] = 'ok';
    try {
      database.get('SELECT 1 AS alive');
    } catch (error) {
      databaseStatus = 'failed';
      request.log.error({ err: error }, 'database health check failed');
    }
    return {
      status: databaseStatus === 'ok' ? 'ok' : 'degraded',
      service: 'chaosboard-server',
      nodeVersion: process.version,
      checks: { database: databaseStatus },
    };
  });
}
