import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { SqlDatabase } from './db';
import type { ModuleMigrations } from './migrations';

export interface UserSessionProfile {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly avatar: string;
}

export interface AuthConfig {
  readonly jwtSecret?: string;
  readonly jwtExpiresIn?: number;
  readonly allowDevMockAuth?: boolean;
  readonly googleClientId?: string;
  readonly firebaseProjectId?: string;
  readonly githubClientId?: string;
  readonly githubClientSecret?: string;
}

export const DEMO_AUTH_TOKEN = 'sre-session-demo-token-2026';
export const DEFAULT_JWT_SECRET = 'chaosboard-default-jwt-secret-replace-in-production-2026';
export const DEFAULT_JWT_EXPIRES_IN = 14 * 24 * 60 * 60; // 14 days in seconds

export const authMigrations: ModuleMigrations = {
  module: 'auth',
  migrations: [
    {
      version: 1,
      name: 'create_auth_tables',
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'Staff SRE',
          avatar TEXT NOT NULL DEFAULT 'SRE',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `,
    },
  ],
};

function base64UrlEncode(input: string | Buffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

/**
 * Standard RFC 7519 HMAC-SHA256 (HS256) JSON Web Token signing.
 */
export function signJwt(
  payload: object,
  secret: string = DEFAULT_JWT_SECRET,
  expiresInSeconds: number = DEFAULT_JWT_EXPIRES_IN,
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...(payload as Record<string, unknown>),
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac('sha256', secret).update(data).digest();
  const encodedSignature = base64UrlEncode(signature);

  return `${data}.${encodedSignature}`;
}

/**
 * Standard RFC 7519 HMAC-SHA256 (HS256) JSON Web Token verification.
 */
export function verifyJwt<T = Record<string, unknown>>(
  token: string,
  secret: string = DEFAULT_JWT_SECRET,
  validator?: (payload: unknown) => payload is T,
): { valid: true; payload: T } | { valid: false; error: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed token structure' };
    }
    const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];
    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createHmac('sha256', secret).update(data).digest();
    const actualSignature = Buffer.from(encodedSignature, 'base64url');

    if (
      expectedSignature.length !== actualSignature.length ||
      !timingSafeEqual(expectedSignature, actualSignature)
    ) {
      return { valid: false, error: 'Invalid token signature' };
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as T & { exp?: number };
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Token has expired' };
    }

    if (validator && !validator(payload)) {
      return { valid: false, error: 'Token payload failed validation' };
    }

    return { valid: true, payload };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Token verification failed',
    };
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash) return false;
    const computedHash = scryptSync(password, salt, 64).toString('hex');
    const a = Buffer.from(computedHash, 'hex');
    const b = Buffer.from(originalHash, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function seedDefaultUsersAndSessions(
  db: SqlDatabase,
  allowDemoUsers = process.env.NODE_ENV !== 'production',
): void {
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Staff SRE',
      avatar TEXT NOT NULL DEFAULT 'SRE',
      created_at TEXT NOT NULL
    )`);
    db.exec(`CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);

    if (!allowDemoUsers) {
      return;
    }

    const now = new Date().toISOString();
    const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Platform Engineer (Default active reviewer)
    db.run(
      `INSERT OR IGNORE INTO users (id, email, password_hash, name, role, avatar, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'eng-platform-engineer',
        'engineer@echmameet.dev',
        hashPassword('chaosboard123'),
        'Platform Engineer',
        'Staff SRE',
        'PE',
        now,
      ],
    );

    // 2. Alex Chen (Secondary test user)
    db.run(
      `INSERT OR IGNORE INTO users (id, email, password_hash, name, role, avatar, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'eng-alex-chen',
        'alex.chen@echmameet.dev',
        hashPassword('chaosboard123'),
        'Alex Chen',
        'Staff SRE',
        'AC',
        now,
      ],
    );

    // 3. Elena Rostova
    db.run(
      `INSERT OR IGNORE INTO users (id, email, password_hash, name, role, avatar, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'eng-guest-reviewer',
        'elena.rostova@echmameet.dev',
        hashPassword('chaosboard123'),
        'Elena Rostova',
        'Guest Reviewer',
        'ER',
        now,
      ],
    );

    // Seed default tokens for Platform Engineer
    db.run(
      `INSERT OR IGNORE INTO sessions (token, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
      [DEMO_AUTH_TOKEN, 'eng-platform-engineer', now, farFuture],
    );
    db.run(
      `INSERT OR IGNORE INTO sessions (token, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
      ['local-offline-session-token', 'eng-platform-engineer', now, farFuture],
    );
  } catch {
    // Database might be closed or mock
  }
}

function sendAuthProblem(
  reply: FastifyReply,
  status: number,
  code: string,
  detail: string,
): FastifyReply {
  return reply
    .status(status)
    .header('content-type', 'application/problem+json')
    .send({
      type: 'about:blank',
      title:
        status === 400
          ? 'Bad Request'
          : status === 401
            ? 'Unauthorized'
            : status === 409
              ? 'Conflict'
              : 'Error',
      status,
      detail,
      code,
    });
}

const registerSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(4),
  name: z.string().optional(),
  role: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().min(3),
  password: z.string().min(1),
});

const googleAuthSchema = z.object({
  credential: z.string().optional(),
  idToken: z.string().optional(),
  accessToken: z.string().optional(),
  profile: z
    .object({
      email: z.email().optional(),
      name: z.string().optional(),
      avatar: z.string().optional(),
    })
    .optional(),
});

const githubAuthSchema = z.object({
  code: z.string().optional(),
  accessToken: z.string().optional(),
  profile: z
    .object({
      email: z.email().optional(),
      name: z.string().optional(),
      avatar: z.string().optional(),
    })
    .optional(),
});

const ssoSchema = z.object({
  provider: z.enum(['google', 'github']),
  profile: z.object({
    email: z.email(),
    name: z.string(),
    role: z.string().optional(),
    avatar: z.string().optional(),
  }),
});

export interface VerifiedOauthProfile {
  readonly email: string;
  readonly name: string;
  readonly avatar?: string | undefined;
}

export async function verifyGoogleToken(
  rawToken: string,
  config?: AuthConfig,
): Promise<VerifiedOauthProfile | null> {
  // If running in development/test with explicit dev mock authorization enabled
  if (
    config?.allowDevMockAuth &&
    (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development')
  ) {
    const verified = verifyJwt<{
      email?: string;
      name?: string;
      picture?: string;
      avatar?: string;
    }>(rawToken, config.jwtSecret || DEFAULT_JWT_SECRET);
    if (verified.valid && verified.payload.email) {
      return {
        email: verified.payload.email,
        name: verified.payload.name || 'Google SRE Reviewer',
        avatar: verified.payload.picture || verified.payload.avatar,
      };
    }
  }

  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(rawToken)}`,
      { signal: AbortSignal.timeout(2000) },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      email?: string;
      email_verified?: string | boolean;
      name?: string;
      picture?: string;
      aud?: string;
    };
    if (!body.email) return null;
    if (body.email_verified !== 'true' && body.email_verified !== true) return null;
    if (config?.googleClientId && body.aud && body.aud !== config.googleClientId) {
      return null;
    }
    return {
      email: body.email,
      name: body.name || 'Google SRE Reviewer',
      avatar: body.picture,
    };
  } catch {
    return null;
  }
}

export async function verifyGithubToken(
  code: string | undefined,
  accessToken: string | undefined,
  config?: AuthConfig,
): Promise<VerifiedOauthProfile | null> {
  let effectiveToken = accessToken;
  if (code && config?.githubClientId && config.githubClientSecret) {
    try {
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: config.githubClientId,
          client_secret: config.githubClientSecret,
          code,
        }),
        signal: AbortSignal.timeout(2000),
      });
      if (tokenResponse.ok) {
        const tokenData = (await tokenResponse.json()) as { access_token?: string };
        effectiveToken = tokenData.access_token;
      }
    } catch {
      return null;
    }
  }

  if (
    config?.allowDevMockAuth &&
    (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') &&
    effectiveToken
  ) {
    const verified = verifyJwt<{ email?: string; name?: string; avatar?: string }>(
      effectiveToken,
      config.jwtSecret || DEFAULT_JWT_SECRET,
    );
    if (verified.valid && verified.payload.email) {
      return {
        email: verified.payload.email,
        name: verified.payload.name || 'GitHub Staff Engineer',
        avatar: verified.payload.avatar,
      };
    }
  }

  if (!effectiveToken) return null;

  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        authorization: `Bearer ${effectiveToken}`,
        'user-agent': 'ChaosBoard-Auth',
      },
      signal: AbortSignal.timeout(2000),
    });
    if (!userRes.ok) return null;
    const ghUser = (await userRes.json()) as {
      email?: string;
      login?: string;
      name?: string;
      avatar_url?: string;
    };
    let email = ghUser.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          authorization: `Bearer ${effectiveToken}`,
          'user-agent': 'ChaosBoard-Auth',
        },
        signal: AbortSignal.timeout(2000),
      });
      if (emailsRes.ok) {
        const emails = (await emailsRes.json()) as Array<{
          email: string;
          primary: boolean;
          verified: boolean;
        }>;
        const primary =
          emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
        if (primary) email = primary.email;
      }
    }
    if (!email) return null;
    return {
      email,
      name: ghUser.name ?? ghUser.login ?? 'GitHub Staff Engineer',
      avatar: ghUser.avatar_url,
    };
  } catch {
    return null;
  }
}

export function registerAuthRoutes(
  app: FastifyInstance,
  db: SqlDatabase,
  config?: AuthConfig,
): void {
  seedDefaultUsersAndSessions(db);
  const jwtSecret = config?.jwtSecret || DEFAULT_JWT_SECRET;
  const jwtExpiresIn = config?.jwtExpiresIn || DEFAULT_JWT_EXPIRES_IN;

  // GET /api/auth/config (Public auth provider discovery for frontend)
  app.get('/api/auth/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      googleClientId: config?.googleClientId || '',
      firebaseProjectId: config?.firebaseProjectId || '',
      githubClientId: config?.githubClientId || '',
      providers: [
        'password',
        ...(config?.googleClientId || config?.firebaseProjectId ? ['google'] : ['google_dev']),
        ...(config?.githubClientId ? ['github'] : ['github_dev']),
      ],
    });
  });

  // POST /api/auth/session (Issue real signed cryptographic session for active user/guest)
  app.post('/api/auth/session', async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionBodySchema = z.object({
      name: z.string().optional(),
      role: z.string().optional(),
      email: z.string().optional(),
    });
    const parsed = sessionBodySchema.safeParse(request.body ?? {});
    const data = parsed.success ? parsed.data : {};
    const displayName = data.name?.trim() || 'Platform Engineer';
    const userRole = data.role?.trim() || 'Staff SRE';
    const userId = `usr_${randomBytes(8).toString('hex')}`;
    const initials =
      displayName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'PE';
    const email = data.email?.trim() || 'engineer@echmameet.local';
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + jwtExpiresIn * 1000).toISOString();

    const user: UserSessionProfile = {
      userId,
      name: displayName,
      email,
      role: userRole,
      avatar: initials,
    };

    const token = signJwt(user, jwtSecret, jwtExpiresIn);

    db.run(
      `INSERT OR IGNORE INTO users (id, email, password_hash, name, role, avatar, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, email, hashPassword('session_' + userId), displayName, userRole, initials, now],
    );
    db.run(
      `INSERT OR IGNORE INTO sessions (token, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
      [token, userId, now, expiresAt],
    );

    return reply.status(200).send({ token, user });
  });

  // POST /api/auth/register
  app.post('/api/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = registerSchema.safeParse(request.body);
    if (!parse.success) {
      return sendAuthProblem(
        reply,
        400,
        'invalid_fields',
        'Invalid registration fields. Password must be at least 4 characters.',
      );
    }

    const { email, password, name, role } = parse.data;
    const cleanEmail = email.toLowerCase().trim();
    const existing = db.get('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      return sendAuthProblem(
        reply,
        409,
        'already_exists',
        'An account with this email address already exists.',
      );
    }

    const userId = `usr_${randomBytes(12).toString('hex')}`;
    const displayName = name?.trim() || cleanEmail.split('@')[0] || 'SRE Reviewer';
    const initials =
      displayName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'US';
    const userRole = role?.trim() || 'Site Reliability Engineer';
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + jwtExpiresIn * 1000).toISOString();

    db.run(
      `INSERT INTO users (id, email, password_hash, name, role, avatar, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, cleanEmail, hashPassword(password), displayName, userRole, initials, now],
    );

    const user: UserSessionProfile = {
      userId,
      name: displayName,
      email: cleanEmail,
      role: userRole,
      avatar: initials,
    };

    const token = signJwt(user, jwtSecret, jwtExpiresIn);

    db.run(
      `INSERT INTO sessions (token, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
      [token, userId, now, expiresAt],
    );

    return reply.status(201).send({ token, user });
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = loginSchema.safeParse(request.body);
    if (!parse.success) {
      return sendAuthProblem(
        reply,
        400,
        'invalid_fields',
        'Please provide both email and password.',
      );
    }

    const { email, password } = parse.data;
    const cleanEmail = email.toLowerCase().trim();
    const userRow = db.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    if (!userRow || typeof userRow['password_hash'] !== 'string') {
      return sendAuthProblem(
        reply,
        401,
        'invalid_credentials',
        'Invalid credentials. Please verify your email and password.',
      );
    }

    const valid = verifyPassword(password, userRow['password_hash']);
    if (!valid) {
      return sendAuthProblem(
        reply,
        401,
        'invalid_credentials',
        'Invalid credentials. Please verify your email and password.',
      );
    }

    const user: UserSessionProfile = {
      userId: String(userRow['id']),
      name: String(userRow['name']),
      email: String(userRow['email']),
      role: String(userRow['role']),
      avatar: String(userRow['avatar']),
    };

    const token = signJwt(user, jwtSecret, jwtExpiresIn);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + jwtExpiresIn * 1000).toISOString();

    db.run(
      `INSERT INTO sessions (token, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
      [token, user.userId, now, expiresAt],
    );

    return reply.status(200).send({ token, user });
  });

  // POST /api/auth/google (Google OAuth & Firebase ID Token verification)
  app.post('/api/auth/google', async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = googleAuthSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid Google authentication request payload.',
      });
    }

    const { credential, idToken } = parse.data;
    const rawToken = credential || idToken;
    if (!rawToken) {
      return sendAuthProblem(
        reply,
        401,
        'unauthorized',
        'Google authentication requires an idToken or credential token.',
      );
    }

    const verified = await verifyGoogleToken(rawToken, config);
    if (!verified) {
      return sendAuthProblem(
        reply,
        401,
        'unauthorized',
        'Google token signature or identity verification failed.',
      );
    }

    const cleanEmail = verified.email.toLowerCase().trim();
    const name = verified.name;
    const avatar = verified.avatar;
    let userRow = db.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + jwtExpiresIn * 1000).toISOString();

    if (!userRow) {
      const userId = `usr_g_${randomBytes(10).toString('hex')}`;
      const initials =
        avatar && !avatar.startsWith('http')
          ? avatar
          : name
              .split(' ')
              .map((p) => p[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || 'GG';

      db.run(
        `INSERT INTO users (id, email, password_hash, name, role, avatar, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          cleanEmail,
          hashPassword(randomBytes(16).toString('hex')),
          name,
          'Staff Infrastructure Architect (Google)',
          initials,
          now,
        ],
      );
      userRow = db.get('SELECT * FROM users WHERE id = ?', [userId]);
    }

    if (!userRow) {
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error' });
    }

    const user: UserSessionProfile = {
      userId: String(userRow['id']),
      name: String(userRow['name']),
      email: String(userRow['email']),
      role: String(userRow['role']),
      avatar: String(userRow['avatar']),
    };

    const token = signJwt(user, jwtSecret, jwtExpiresIn);
    db.run(
      `INSERT INTO sessions (token, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
      [token, user.userId, now, expiresAt],
    );

    return reply.status(200).send({ token, user });
  });

  // POST /api/auth/github (GitHub OAuth code exchange & user sync)
  app.post('/api/auth/github', async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = githubAuthSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid GitHub authentication request payload.',
      });
    }

    const { code, accessToken } = parse.data;
    if (!code && !accessToken) {
      return sendAuthProblem(
        reply,
        401,
        'unauthorized',
        'GitHub authentication requires either an OAuth code or an accessToken.',
      );
    }

    const verified = await verifyGithubToken(code, accessToken, config);
    if (!verified) {
      return sendAuthProblem(
        reply,
        401,
        'unauthorized',
        'GitHub OAuth verification failed or no verified email address found.',
      );
    }

    const cleanEmail = verified.email.toLowerCase().trim();
    const name = verified.name;
    const avatar = verified.avatar;
    let userRow = db.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + jwtExpiresIn * 1000).toISOString();

    if (!userRow) {
      const userId = `usr_gh_${randomBytes(10).toString('hex')}`;
      const initials =
        avatar && !avatar.startsWith('http')
          ? avatar
          : name
              .split(' ')
              .map((p) => p[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || 'GH';

      db.run(
        `INSERT INTO users (id, email, password_hash, name, role, avatar, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          cleanEmail,
          hashPassword(randomBytes(16).toString('hex')),
          name,
          'Distributed Systems Architect (GitHub)',
          initials,
          now,
        ],
      );
      userRow = db.get('SELECT * FROM users WHERE id = ?', [userId]);
    }

    if (!userRow) {
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error' });
    }

    const user: UserSessionProfile = {
      userId: String(userRow['id']),
      name: String(userRow['name']),
      email: String(userRow['email']),
      role: String(userRow['role']),
      avatar: String(userRow['avatar']),
    };

    const token = signJwt(user, jwtSecret, jwtExpiresIn);
    db.run(
      `INSERT INTO sessions (token, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
      [token, user.userId, now, expiresAt],
    );

    return reply.status(200).send({ token, user });
  });

  // POST /api/auth/sso
  app.post('/api/auth/sso', async (request: FastifyRequest, reply: FastifyReply) => {
    // In production without explicit mock auth, reject arbitrary unverified SSO posts
    if (process.env.NODE_ENV === 'production' && !config?.allowDevMockAuth) {
      return sendAuthProblem(
        reply,
        403,
        'sso_not_configured',
        'Enterprise SSO SAML/OIDC assertions must be configured via identity provider.',
      );
    }

    const parse = ssoSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid SSO payload.',
      });
    }

    const { profile } = parse.data;
    const email = profile.email.toLowerCase().trim();
    let userRow = db.get('SELECT * FROM users WHERE email = ?', [email]);

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + jwtExpiresIn * 1000).toISOString();

    if (!userRow) {
      const userId = `sso_${randomBytes(12).toString('hex')}`;
      const initials =
        profile.avatar ||
        profile.name
          .split(' ')
          .map((p) => p[0])
          .join('')
          .toUpperCase()
          .slice(0, 2) ||
        'SSO';

      db.run(
        `INSERT INTO users (id, email, password_hash, name, role, avatar, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          email,
          hashPassword(randomBytes(16).toString('hex')),
          profile.name,
          profile.role || 'Distributed Systems Architect',
          initials,
          now,
        ],
      );
      userRow = db.get('SELECT * FROM users WHERE id = ?', [userId]);
    }

    if (!userRow) {
      return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error' });
    }

    const user: UserSessionProfile = {
      userId: String(userRow['id']),
      name: String(userRow['name']),
      email: String(userRow['email']),
      role: String(userRow['role']),
      avatar: String(userRow['avatar']),
    };

    const token = signJwt(user, jwtSecret, jwtExpiresIn);
    db.run(
      `INSERT INTO sessions (token, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
      [token, user.userId, now, expiresAt],
    );

    return reply.status(200).send({ token, user });
  });

  // GET /api/auth/me
  app.get('/api/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return sendAuthProblem(reply, 401, 'unauthorized', 'Authentication token required.');
    }

    const token = authHeader.slice(7).trim();

    // 1. First attempt JWT cryptographic verification
    const verifiedJwt = verifyJwt<UserSessionProfile>(token, jwtSecret);
    if (verifiedJwt.valid && verifiedJwt.payload.userId) {
      const userRow = db.get('SELECT id, email, name, role, avatar FROM users WHERE id = ?', [
        verifiedJwt.payload.userId,
      ]);
      if (userRow) {
        return reply.status(200).send({
          user: {
            userId: String(userRow['id']),
            name: String(userRow['name']),
            email: String(userRow['email']),
            role: String(userRow['role']),
            avatar: String(userRow['avatar']),
          },
        });
      }
    }

    // 2. Fall back to sessions table lookup
    const row = db.get(
      `SELECT u.id, u.email, u.name, u.role, u.avatar, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
      [token],
    );

    if (!row || new Date(String(row['expires_at'])).getTime() <= Date.now()) {
      return sendAuthProblem(reply, 401, 'unauthorized', 'Invalid or expired session token.');
    }

    const user: UserSessionProfile = {
      userId: String(row['id']),
      name: String(row['name']),
      email: String(row['email']),
      role: String(row['role']),
      avatar: String(row['avatar']),
    };

    return reply.status(200).send({ user });
  });

  // POST /api/auth/logout
  app.post('/api/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      db.run('DELETE FROM sessions WHERE token = ?', [token]);
    }
    return reply.status(200).send({ success: true });
  });
}

/**
 * Global HTTP Authentication Guard.
 * Inspects all incoming requests to /api/*. Public endpoints (/api/health, /api/auth/*, etc.)
 * are exempt; all others require a valid cryptographic JWT or database session Bearer token.
 */
export function authenticateToken(
  token: string | undefined | null,
  db?: SqlDatabase,
  jwtSecret: string = DEFAULT_JWT_SECRET,
): UserSessionProfile | null {
  if (!token || typeof token !== 'string') return null;
  const trimmed = token.trim();

  // 1. Verify via signed JWT
  const verifiedJwt = verifyJwt<UserSessionProfile>(trimmed, jwtSecret);
  if (verifiedJwt.valid && verifiedJwt.payload.userId) {
    if (db) {
      const userRow = db.get('SELECT id, email, name, role, avatar FROM users WHERE id = ?', [
        verifiedJwt.payload.userId,
      ]);
      if (userRow) {
        return {
          userId: String(userRow['id']),
          name: String(userRow['name']),
          email: String(userRow['email']),
          role: String(userRow['role']),
          avatar: String(userRow['avatar']),
        };
      }
    }
    // If JWT is cryptographically valid, accept payload even if DB in-memory state restarted
    return {
      userId: verifiedJwt.payload.userId,
      name: verifiedJwt.payload.name || 'User',
      email: verifiedJwt.payload.email || 'user@internal',
      role: verifiedJwt.payload.role || 'Staff SRE',
      avatar: verifiedJwt.payload.avatar || 'SRE',
    };
  }

  // 2. Fall back to sessions table if db is available
  if (db) {
    const row = db.get(
      `SELECT u.id, u.email, u.name, u.role, u.avatar, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
      [trimmed],
    );

    if (row && new Date(String(row['expires_at'])).getTime() > Date.now()) {
      return {
        userId: String(row['id']),
        name: String(row['name']),
        email: String(row['email']),
        role: String(row['role']),
        avatar: String(row['avatar']),
      };
    }
  }

  return null;
}

export function installAuthGuard(app: FastifyInstance, db: SqlDatabase, config?: AuthConfig): void {
  const jwtSecret = config?.jwtSecret || DEFAULT_JWT_SECRET;

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Parse URL pathname safely, completely immune to query parameter tampering
    const pathname = new URL(request.url, 'http://localhost').pathname;

    if (!pathname.startsWith('/api/')) {
      return;
    }

    // Whitelist of public endpoints (health, auth handshakes, meeting rooms, speech synthesis, AI copilot)
    const isPublic =
      pathname === '/api/health' ||
      pathname === '/api/auth/login' ||
      pathname === '/api/auth/register' ||
      pathname === '/api/auth/session' ||
      pathname === '/api/auth/google' ||
      pathname === '/api/auth/github' ||
      pathname === '/api/auth/config' ||
      pathname === '/api/scenarios' ||
      pathname.startsWith('/api/scenarios/') ||
      pathname === '/api/benchmarks/results' ||
      pathname === '/api/topologies/scenarios' ||
      pathname.startsWith('/api/gnani/') ||
      pathname.startsWith('/api/rooms/') ||
      pathname.startsWith('/api/meeting/');

    const authHeader = request.headers.authorization;
    const queryToken = (request.query as Record<string, unknown> | undefined)?.['token'];
    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (typeof queryToken === 'string' && queryToken.trim().length > 0) {
      token = queryToken.trim();
    }

    if (token) {
      const authenticatedUser = authenticateToken(token, db, jwtSecret);
      if (authenticatedUser) {
        (request as FastifyRequest & { user: UserSessionProfile }).user = authenticatedUser;
      }
    }

    if (isPublic) {
      return;
    }

    if (!(request as FastifyRequest & { user?: UserSessionProfile }).user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Access denied: Authentication required for architecture review workspace.',
      });
    }
  });
}
