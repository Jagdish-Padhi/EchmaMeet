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

  /** Registers a genuine account and returns its session token. */
  async function signIn(app: ReturnType<typeof buildApp>): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `tester-${String(Math.random()).slice(2, 8)}@example.test`,
        password: 'correct-horse-9',
        name: 'Tester',
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json<{ token: string }>().token;
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
    const app = start();
    const token = await signIn(app);
    const response = await app.inject({
      method: 'GET',
      url: '/api/nothing-here',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const problem = problemDetailsSchema.parse(response.json());
    expect(problem.code).toBe('route_not_found');
  });

  it('mounts the topology validation route when authenticated', async () => {
    const app = start();
    const token = await signIn(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/topologies/validate',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(validateTopologyResponseSchema.parse(response.json()).valid).toBe(false);
  });

  it('answers malformed JSON with problem details and a client error status', async () => {
    const app = start();
    const token = await signIn(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/topologies/validate',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: '{ broken',
    });
    expect(response.statusCode).toBe(400);
    const problem = problemDetailsSchema.parse(response.json());
    expect(problem.status).toBe(400);
  });

  it('issues distinct sessions for logins in the same second (token is the session key)', async () => {
    const app = start();
    const email = 'rapid@example.test';
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password: 'correct-horse-9', name: 'R' },
    });
    const tokens = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password: 'correct-horse-9' },
      });
      expect(res.statusCode).toBe(200);
      tokens.add(res.json<{ token: string }>().token);
    }
    expect(tokens.size).toBe(5);
  });

  it('does not ship usable demo credentials or session tokens by default', async () => {
    const app = start();
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'alex.chen@meta.internal', password: 'chaosboard123' },
    });
    expect(login.statusCode).toBe(401);
    for (const token of ['sre-session-demo-token-2026', 'local-offline-session-token']) {
      const me = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(me.statusCode).toBe(401);
    }
  });

  it('logs a registered user back in with the correct password only', async () => {
    const app = start();
    const email = 'login-check@example.test';
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password: 'correct-horse-9', name: 'L' },
    });
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'wrong-password' },
    });
    expect(bad.statusCode).toBe(401);
    const good = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'correct-horse-9' },
    });
    expect(good.body).toContain('token');
    expect(good.statusCode).toBe(200);
    expect(good.json<{ token: string; user: { email: string } }>().user.email).toBe(email);
  });

  it('registers a new user and grants session token', async () => {
    const response = await start().inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'jane.doe@meta.internal',
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
