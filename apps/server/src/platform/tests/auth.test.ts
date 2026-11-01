import { describe, expect, it } from 'vitest';
import { IN_MEMORY, openDatabase } from '../db';
import {
  signJwt,
  verifyJwt,
  registerAuthRoutes,
  installAuthGuard,
  type AuthConfig,
  type UserSessionProfile,
} from '../auth';
import Fastify from 'fastify';

describe('JWT engine', () => {
  it('signs and verifies valid HS256 tokens', () => {
    const user: UserSessionProfile = {
      userId: 'eng-123',
      name: 'Test SRE',
      email: 'sre@meta.internal',
      role: 'Staff SRE',
      avatar: 'TS',
    };
    const token = signJwt(user, 'test-secret-12345678901234567890', 3600);
    expect(token.split('.')).toHaveLength(3);

    const verified = verifyJwt<UserSessionProfile>(token, 'test-secret-12345678901234567890');
    expect(verified.valid).toBe(true);
    if (verified.valid) {
      expect(verified.payload.userId).toBe('eng-123');
      expect(verified.payload.email).toBe('sre@meta.internal');
    }
  });

  it('rejects tokens signed with different secret', () => {
    const token = signJwt({ foo: 'bar' }, 'secret-a');
    const verified = verifyJwt(token, 'secret-b');
    expect(verified.valid).toBe(false);
  });

  it('rejects expired tokens', () => {
    const token = signJwt({ foo: 'bar' }, 'secret-a', -10); // Expired 10 seconds ago
    const verified = verifyJwt(token, 'secret-a');
    expect(verified.valid).toBe(false);
    if (!verified.valid) {
      expect(verified.error).toContain('expired');
    }
  });
});

describe('Auth routes and OAuth integrations', () => {
  const authConfig: AuthConfig = {
    jwtSecret: 'test-secret-key-32-chars-long-abc',
    jwtExpiresIn: 3600,
    allowDevMockAuth: true,
    googleClientId: 'google-test-id.apps.googleusercontent.com',
    firebaseProjectId: 'firebase-test-proj',
    githubClientId: 'gh_client_123',
    githubClientSecret: 'gh_secret_456',
  };

  it('serves auth provider configuration', async () => {
    const db = openDatabase(IN_MEMORY);
    const app = Fastify();
    registerAuthRoutes(app, db, authConfig);

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/config',
    });
    expect(response.statusCode).toBe(200);
    const data = response.json<{
      googleClientId: string;
      githubClientId: string;
      providers: string[];
    }>();
    expect(data.googleClientId).toBe('google-test-id.apps.googleusercontent.com');
    expect(data.githubClientId).toBe('gh_client_123');
    expect(data.providers).toContain('google');
    expect(data.providers).toContain('github');
  });

  it('rejects forged login attempts without valid credentials', async () => {
    const db = openDatabase(IN_MEMORY);
    const app = Fastify();
    registerAuthRoutes(app, db, { ...authConfig, allowDevMockAuth: false });

    // Hostile attempt: forging victim email with no token
    const forgedGoogle = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: {
        profile: { email: 'victim@example.com' },
      },
    });
    expect(forgedGoogle.statusCode).toBe(401);

    // Hostile attempt: arbitrary fake id token without signature
    const fakeToken = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: {
        idToken: 'fake.unsigned.jwt',
      },
    });
    expect(fakeToken.statusCode).toBe(401);
  });

  it('prevents query string auth bypass attacks like ?x=/events', async () => {
    const db = openDatabase(IN_MEMORY);
    const app = Fastify();
    app.get('/api/runs', async () => ({ runs: [] }));
    registerAuthRoutes(app, db, authConfig);
    installAuthGuard(app, db, authConfig);

    // Normal access without token is blocked
    const directRes = await app.inject({
      method: 'GET',
      url: '/api/runs',
    });
    expect(directRes.statusCode).toBe(401);

    // Malicious query string attempting to trigger url.includes('/events') bypass
    const bypassRes = await app.inject({
      method: 'GET',
      url: '/api/runs?x=/events',
    });
    expect(bypassRes.statusCode).toBe(401);
  });

  it('authenticates via Google/Firebase endpoint and issues valid JWT', async () => {
    const db = openDatabase(IN_MEMORY);
    const app = Fastify();
    registerAuthRoutes(app, db, authConfig);
    installAuthGuard(app, db, authConfig);

    // Valid signed token for dev/test
    const validTestIdToken = signJwt(
      { email: 'google.engineer@meta.internal', name: 'Sarah Chen (Google)', picture: 'SC' },
      authConfig.jwtSecret,
      3600,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: {
        idToken: validTestIdToken,
      },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json<{ token: string; user: { email: string; name: string } }>();
    expect(data.user.email).toBe('google.engineer@meta.internal');
    expect(data.token.split('.')).toHaveLength(3);

    // Verify token works with /api/auth/me
    const meResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${data.token}`,
      },
    });
    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json<{ user: { email: string } }>().user.email).toBe(
      'google.engineer@meta.internal',
    );
  });

  it('authenticates via GitHub OAuth endpoint and issues valid JWT', async () => {
    const db = openDatabase(IN_MEMORY);
    const app = Fastify();
    app.get('/api/protected-test', async (req) => ({ ok: true, user: (req as any).user }));
    registerAuthRoutes(app, db, authConfig);
    installAuthGuard(app, db, authConfig);

    const validGhToken = signJwt(
      { email: 'github.lead@meta.internal', name: 'Marcus Vance (GitHub)', avatar: 'MV' },
      authConfig.jwtSecret,
      3600,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/github',
      payload: {
        accessToken: validGhToken,
      },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json<{ token: string; user: { email: string; name: string } }>();
    expect(data.user.email).toBe('github.lead@meta.internal');

    // Verify token works against protected endpoint
    const protectedRes = await app.inject({
      method: 'GET',
      url: '/api/protected-test',
      headers: { authorization: `Bearer ${data.token}` },
    });
    expect(protectedRes.statusCode).toBe(200);
  });
});
