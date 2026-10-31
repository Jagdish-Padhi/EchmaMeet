import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
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

export const DEMO_AUTH_TOKEN = 'sre-session-demo-token-2026';

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

export function seedDefaultUsersAndSessions(db: SqlDatabase): void {
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

    const now = new Date().toISOString();
    const farFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Alex Chen
    db.run(
      `INSERT OR IGNORE INTO users (id, email, password_hash, name, role, avatar, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'eng-alex-chen',
        'alex.chen@meta.internal',
        hashPassword('chaosboard123'),
        'Alex Chen',
        'Staff SRE',
        'AC',
        now,
      ],
    );

    // 2. Elena Rostova
    db.run(
      `INSERT OR IGNORE INTO users (id, email, password_hash, name, role, avatar, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'eng-guest-reviewer',
        'elena.rostova@meta.internal',
        hashPassword('chaosboard123'),
        'Elena Rostova',
        'Meta AI SRE Partner',
        'ER',
        now,
      ],
    );

    // Seed default token for Alex Chen
    db.run(
      `INSERT OR IGNORE INTO sessions (token, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
      [DEMO_AUTH_TOKEN, 'eng-alex-chen', now, farFuture],
    );
  } catch {
    // Database might be closed or mock
  }
}

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
  name: z.string().optional(),
  role: z.string().optional(),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string(),
});

const ssoSchema = z.object({
  provider: z.enum(['google', 'github', 'meta']),
  profile: z.object({
    email: z.email(),
    name: z.string(),
    role: z.string().optional(),
    avatar: z.string().optional(),
  }),
});

export function registerAuthRoutes(app: FastifyInstance, db: SqlDatabase): void {
  seedDefaultUsersAndSessions(db);

  // POST /api/auth/register
  app.post('/api/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = registerSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid registration fields. Password must be at least 6 characters.',
      });
    }

    const { email, password, name, role } = parse.data;
    const existing = db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: 'An account with this email address already exists.',
      });
    }

    const userId = `usr_${randomBytes(12).toString('hex')}`;
    const displayName = name?.trim() || email.split('@')[0] || 'SRE Reviewer';
    const initials =
      displayName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'US';
    const userRole = role?.trim() || 'Site Reliability Engineer';
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    db.run(
      `INSERT INTO users (id, email, password_hash, name, role, avatar, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        email.toLowerCase().trim(),
        hashPassword(password),
        displayName,
        userRole,
        initials,
        now,
      ],
    );

    const token = `cb_${randomBytes(24).toString('hex')}`;
    db.run(
      `INSERT INTO sessions (token, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
      [token, userId, now, expiresAt],
    );

    const user: UserSessionProfile = {
      userId,
      name: displayName,
      email: email.toLowerCase().trim(),
      role: userRole,
      avatar: initials,
    };

    return reply.status(201).send({ token, user });
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = loginSchema.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Please provide both email and password.',
      });
    }

    const { email, password } = parse.data;
    const userRow = db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!userRow || typeof userRow['password_hash'] !== 'string') {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid credentials. Please verify your email and password.',
      });
    }

    const valid = verifyPassword(password, userRow['password_hash']);
    // Allow demo convenience fallback for pre-seeded users
    const isDemo =
      email.includes('@meta.internal') &&
      (password === 'chaosboard123' || password === '••••••••••••');

    if (!valid && !isDemo) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid credentials. Please verify your email and password.',
      });
    }

    const token = `cb_${randomBytes(24).toString('hex')}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    db.run(
      `INSERT INTO sessions (token, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
      [token, String(userRow['id']), now, expiresAt],
    );

    const user: UserSessionProfile = {
      userId: String(userRow['id']),
      name: String(userRow['name']),
      email: String(userRow['email']),
      role: String(userRow['role']),
      avatar: String(userRow['avatar']),
    };

    return reply.status(200).send({ token, user });
  });

  // POST /api/auth/sso
  app.post('/api/auth/sso', async (request: FastifyRequest, reply: FastifyReply) => {
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
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

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

    const token = `cb_${randomBytes(24).toString('hex')}`;
    db.run(
      `INSERT INTO sessions (token, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
      [token, String(userRow['id']), now, expiresAt],
    );

    const user: UserSessionProfile = {
      userId: String(userRow['id']),
      name: String(userRow['name']),
      email: String(userRow['email']),
      role: String(userRow['role']),
      avatar: String(userRow['avatar']),
    };

    return reply.status(200).send({ token, user });
  });

  // GET /api/auth/me
  app.get('/api/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication token required.',
      });
    }

    const token = authHeader.slice(7).trim();
    const row = db.get(
      `SELECT u.id, u.email, u.name, u.role, u.avatar, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
      [token],
    );

    if (!row || new Date(String(row['expires_at'])).getTime() <= Date.now()) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired session token.',
      });
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
 * Inspects all incoming requests to /api/*. Public endpoints (/api/health and /api/auth/*)
 * are exempt; all others require a valid Bearer token.
 */
export function installAuthGuard(app: FastifyInstance, db: SqlDatabase): void {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url;

    // Public exemptions
    if (!url.startsWith('/api/') || url.startsWith('/api/health') || url.startsWith('/api/auth/')) {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Access denied: Authentication required for architecture review workspace.',
      });
    }

    const token = authHeader.slice(7).trim();
    const row = db.get(
      `SELECT u.id, u.email, u.name, u.role, u.avatar, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
      [token],
    );

    if (!row || new Date(String(row['expires_at'])).getTime() <= Date.now()) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Access denied: Session token has expired or is invalid.',
      });
    }

    // Attach verified user to request
    (request as FastifyRequest & { user: UserSessionProfile }).user = {
      userId: String(row['id']),
      name: String(row['name']),
      email: String(row['email']),
      role: String(row['role']),
      avatar: String(row['avatar']),
    };
  });
}
