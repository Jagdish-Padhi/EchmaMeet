import {
  healthResponseSchema,
  problemDetailsSchema,
  validateTopologyResponseSchema,
} from '@chaosboard/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { IN_MEMORY, openDatabase, type SqlDatabase } from '../src/platform/db';
import { createLogger } from '../src/platform/logging';

const logger = createLogger({ logLevel: 'silent', nodeEnv: 'test' });

describe('application', () => {
  const closers: (() => Promise<void> | void)[] = [];

  afterEach(async () => {
    for (const close of closers.splice(0)) {
      await close();
    }
  });

  function start(database: SqlDatabase = openDatabase(IN_MEMORY)): ReturnType<typeof buildApp> {
    const app = buildApp({ logger, database });
    closers.push(() => app.close());
    closers.push(() => {
      try {
        database.close();
      } catch {
        // the test closed it already
      }
    });
    return app;
  }

  it('reports healthy when the database answers', async () => {
    const response = await start().inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    const body = healthResponseSchema.parse(response.json());
    expect(body.status).toBe('ok');
    expect(body.checks.database).toBe('ok');
    expect(body.nodeVersion).toBe(process.version);
  });

  it('reports degraded, not ok, when the database fails', async () => {
    const database = openDatabase(IN_MEMORY);
    const app = start(database);
    database.close();
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    const body = healthResponseSchema.parse(response.json());
    expect(body.status).toBe('degraded');
    expect(body.checks.database).toBe('failed');
  });

  it('answers unknown routes with problem details', async () => {
    const response = await start().inject({ method: 'GET', url: '/api/nothing-here' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const problem = problemDetailsSchema.parse(response.json());
    expect(problem.code).toBe('route_not_found');
  });

  it('mounts the topology validation route', async () => {
    const response = await start().inject({
      method: 'POST',
      url: '/api/topologies/validate',
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(validateTopologyResponseSchema.parse(response.json()).valid).toBe(false);
  });

  it('answers malformed JSON with problem details and a client error status', async () => {
    const response = await start().inject({
      method: 'POST',
      url: '/api/topologies/validate',
      headers: { 'content-type': 'application/json' },
      payload: '{ broken',
    });
    expect(response.statusCode).toBe(400);
    const problem = problemDetailsSchema.parse(response.json());
    expect(problem.status).toBe(400);
  });
});
