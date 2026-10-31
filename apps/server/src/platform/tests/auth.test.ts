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
    const data = response.json<{ googleClientId: string; githubClientId: string; providers: string[] }>();
    expect(data.googleClientId).toBe('google-test-id.apps.googleusercontent.com');
    expect(data.githubClientId).toBe('gh_client_123');
    expect(data.providers).toContain('google');
    expect(data.providers).toContain('github');
  });

  it('authenticates via Google/Firebase endpoint and issues valid JWT', async () => {
    const db = openDatabase(IN_MEMORY);
    const app = Fastify();
    registerAuthRoutes(app, db, authConfig);
    installAuthGuard(app, db, authConfig);

    // Mock Google payload
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/google',
      payload: {
        profile: {
          email: 'google.engineer@meta.internal',
          name: 'Sarah Chen (Google)',
          avatar: 'SC',
        },
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
    expect(meResponse.json<{ user: { email: string } }>().user.email).toBe('google.engineer@meta.internal');
  });

  it('authenticates via GitHub OAuth endpoint and issues valid JWT', async () => {
    const db = openDatabase(IN_MEMORY);
    const app = Fastify();
    app.get('/api/protected-test', async (req) => ({ ok: true, user: (req as any).user }));
    registerAuthRoutes(app, db, authConfig);
    installAuthGuard(app, db, authConfig);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/github',
      payload: {
        profile: {
          email: 'github.lead@meta.internal',
          name: 'Marcus Vance (GitHub)',
          avatar: 'MV',
        },
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
