import {
  healthResponseSchema,
  problemDetailsSchema,
  validateTopologyResponseSchema,
} from '@chaosboard/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { IN_MEMORY, openDatabase, type SqlDatabase } from '../src/platform/db';
import { createLogger } from '../src/platform/logging';
import { DEMO_AUTH_TOKEN } from '../src/platform/auth';

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
  }, 15_000);

  it('reports degraded, not ok, when the database fails', async () => {
    const database = openDatabase(IN_MEMORY);
    const app = start(database);
    database.close();
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    const body = healthResponseSchema.parse(response.json());
    expect(body.status).toBe('degraded');
    expect(body.checks.database).toBe('failed');
  });

  it('rejects unauthenticated requests to protected API routes with 401', async () => {
    const response = await start().inject({
      method: 'POST',
      url: '/api/topologies/validate',
      payload: {},
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual(
      expect.objectContaining({
        statusCode: 401,
        error: 'Unauthorized',
      }),
    );
  });

  it('answers unknown routes with problem details when authenticated', async () => {
    const response = await start().inject({
      method: 'GET',
      url: '/api/nothing-here',
      headers: { authorization: `Bearer ${DEMO_AUTH_TOKEN}` },
    });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const problem = problemDetailsSchema.parse(response.json());
    expect(problem.code).toBe('route_not_found');
  });

  it('mounts the topology validation route when authenticated', async () => {
    const response = await start().inject({
      method: 'POST',
      url: '/api/topologies/validate',
      headers: { authorization: `Bearer ${DEMO_AUTH_TOKEN}` },
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(validateTopologyResponseSchema.parse(response.json()).valid).toBe(false);
  });

  it('answers malformed JSON with problem details and a client error status', async () => {
    const response = await start().inject({
      method: 'POST',
      url: '/api/topologies/validate',
      headers: {
        authorization: `Bearer ${DEMO_AUTH_TOKEN}`,
        'content-type': 'application/json',
      },
      payload: '{ broken',
    });
    expect(response.statusCode).toBe(400);
    const problem = problemDetailsSchema.parse(response.json());
    expect(problem.status).toBe(400);
  });

  it('authenticates login and returns session token', async () => {
    const response = await start().inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'alex.chen@echmameet.dev',
        password: 'chaosboard123',
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ token: string; user: { email: string; name: string } }>();
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe('alex.chen@echmameet.dev');
  });

  it('registers a new user and grants session token', async () => {
    const response = await start().inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'jane.doe@echmameet.dev',
        password: 'securepassword123',
        name: 'Jane Doe',
        role: 'Senior SRE',
      },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json<{ token: string; user: { email: string; name: string } }>();
    expect(body.token).toBeTruthy();
    expect(body.user.name).toBe('Jane Doe');
  });
});
