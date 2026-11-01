import { z } from 'zod';

const settingsSchema = z.strictObject({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVER_HOST: z.string().min(1).default('127.0.0.1'),
  SERVER_PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  DATA_DIR: z.string().min(1).default('./data'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().optional().default(''),
  REDIS_URL: z.string().optional().default(''),
  TOXIPROXY_URL: z.url().default('http://127.0.0.1:8474'),
  TOXIPROXY_UPSTREAM_HOST: z.string().default('host.docker.internal'),
  PARTNER_BASE_URL: z.string().default('http://127.0.0.1:8000/v1'),
  PARTNER_API_KEY: z.string().default(''),
  PARTNER_MODEL_ID: z.string().default('meta-models/muse-spark-open-1026'),
  AI_PROVIDER: z.enum(['meta', 'groq', 'openai', 'mock', 'auto']).default('auto'),
  JWT_SECRET: z.string().default('chaosboard-default-jwt-secret-replace-in-production-2026'),
  JWT_EXPIRES_IN: z.coerce.number().int().min(60).default(1209600),
  ALLOW_DEV_MOCK_AUTH: z.enum(['true', 'false', '1', '0']).default('false'),
  GOOGLE_CLIENT_ID: z.string().default(''),
  FIREBASE_PROJECT_ID: z.string().default(''),
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
});

export interface Settings {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly host: string;
  readonly port: number;
  readonly dataDir: string;
  readonly logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  readonly databaseUrl: string;
  readonly redisUrl: string;
  readonly toxiproxyUrl: string;
  readonly toxiproxyUpstreamHost: string;
  readonly partnerBaseUrl: string;
  readonly partnerApiKey: string;
  readonly partnerModelId: string;
  readonly aiProvider: 'meta' | 'groq' | 'openai' | 'mock';
  readonly jwtSecret: string;
  readonly jwtExpiresIn: number;
  readonly allowDevMockAuth: boolean;
  readonly googleClientId: string;
  readonly firebaseProjectId: string;
  readonly githubClientId: string;
  readonly githubClientSecret: string;
}

export class ConfigError extends Error {
  readonly variables: readonly string[];

  constructor(message: string, variables: readonly string[]) {
    super(message);
    this.name = 'ConfigError';
    this.variables = variables;
  }
}

const SETTING_NAMES = Object.keys(settingsSchema.shape);

/**
 * Reads settings from an environment object. This is the only place in the server that
 * interprets environment variables. A missing or malformed value fails startup with a message
 * that names the variable.
 */
export function loadSettings(env: Readonly<Record<string, string | undefined>>): Settings {
  const picked: Record<string, string> = {};
  for (const name of SETTING_NAMES) {
    const value = env[name];
    if (value !== undefined && value !== '') {
      picked[name] = value;
    }
  }

  // Support AI_* environment variable aliases
  if (env['AI_PROVIDER'] && !picked['AI_PROVIDER']) {
    picked['AI_PROVIDER'] = env['AI_PROVIDER'];
  }
  if (env['AI_BASE_URL'] && !picked['PARTNER_BASE_URL']) {
    picked['PARTNER_BASE_URL'] = env['AI_BASE_URL'];
  }
  if (env['AI_API_KEY'] && !picked['PARTNER_API_KEY']) {
    picked['PARTNER_API_KEY'] = env['AI_API_KEY'];
  }
  if (env['AI_MODEL_ID'] && !picked['PARTNER_MODEL_ID']) {
    picked['PARTNER_MODEL_ID'] = env['AI_MODEL_ID'];
  }

  // Smart auto-detection for free testing vs Meta production credits:
  const groqApiKey = env['GROQ_API_KEY']?.trim();
  const metaApiKey = env['META_API_KEY']?.trim();

  if (!picked['PARTNER_API_KEY']) {
    if (groqApiKey) {
      picked['PARTNER_API_KEY'] = groqApiKey;
      if (!picked['PARTNER_BASE_URL'] || picked['PARTNER_BASE_URL'].includes('meta.ai')) {
        picked['PARTNER_BASE_URL'] = 'https://api.groq.com/openai/v1';
      }
      if (!picked['PARTNER_MODEL_ID'] || picked['PARTNER_MODEL_ID'].includes('muse')) {
        picked['PARTNER_MODEL_ID'] = 'openai/gpt-oss-120b';
      }
    } else if (metaApiKey) {
      picked['PARTNER_API_KEY'] = metaApiKey;
    }
  }

  // Cross-validation for provider vs endpoint to prevent silent mismatched endpoints
  const explicitProvider = picked['AI_PROVIDER'];
  if (explicitProvider === 'meta') {
    if (picked['PARTNER_BASE_URL']?.includes('groq.com')) {
      throw new ConfigError(
        'Inconsistent AI configuration: AI_PROVIDER is "meta" but PARTNER_BASE_URL points to groq.com.',
        ['AI_PROVIDER', 'PARTNER_BASE_URL'],
      );
    }
  } else if (explicitProvider === 'groq') {
    if (
      picked['PARTNER_BASE_URL']?.includes('meta.ai') ||
      picked['PARTNER_BASE_URL']?.includes('meta.com')
    ) {
      throw new ConfigError(
        'Inconsistent AI configuration: AI_PROVIDER is "groq" but PARTNER_BASE_URL points to Meta endpoint.',
        ['AI_PROVIDER', 'PARTNER_BASE_URL'],
      );
    }
  }

  const parsed = settingsSchema.safeParse(picked);
  if (!parsed.success) {
    const variables = parsed.error.issues.map((issue) => String(issue.path[0] ?? 'unknown'));
    const lines = parsed.error.issues.map(
      (issue) => `${String(issue.path[0] ?? 'unknown')}: ${issue.message}`,
    );
    throw new ConfigError(`Invalid configuration. ${lines.join('; ')}`, variables);
  }

  // Security Hardening: Enforce production JWT secret guard
  if (
    parsed.data.NODE_ENV === 'production' &&
    (parsed.data.JWT_SECRET === 'chaosboard-default-jwt-secret-replace-in-production-2026' ||
      parsed.data.JWT_SECRET.length < 32)
  ) {
    throw new ConfigError(
      'In production, JWT_SECRET must be explicitly set to a cryptographically secure string with at least 32 characters, and cannot be the default development secret.',
      ['JWT_SECRET'],
    );
  }

  // Determine effective provider
  let resolvedProvider: 'meta' | 'groq' | 'openai' | 'mock' = 'mock';
  if (parsed.data.AI_PROVIDER !== 'auto') {
    resolvedProvider = parsed.data.AI_PROVIDER;
  } else if (parsed.data.PARTNER_BASE_URL.includes('groq.com') || (groqApiKey && !metaApiKey)) {
    resolvedProvider = 'groq';
  } else if (parsed.data.PARTNER_BASE_URL.includes('openai.com')) {
    resolvedProvider = 'openai';
  } else if (parsed.data.PARTNER_API_KEY) {
    resolvedProvider = 'meta';
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    host: parsed.data.SERVER_HOST,
    port: parsed.data.SERVER_PORT,
    dataDir: parsed.data.DATA_DIR,
    logLevel: parsed.data.LOG_LEVEL,
    databaseUrl: parsed.data.DATABASE_URL,
    redisUrl: parsed.data.REDIS_URL,
    toxiproxyUrl: parsed.data.TOXIPROXY_URL,
    toxiproxyUpstreamHost: parsed.data.TOXIPROXY_UPSTREAM_HOST,
    partnerBaseUrl: parsed.data.PARTNER_BASE_URL,
    partnerApiKey: parsed.data.PARTNER_API_KEY,
    partnerModelId: parsed.data.PARTNER_MODEL_ID,
    aiProvider: resolvedProvider,
    jwtSecret: parsed.data.JWT_SECRET,
    jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,
    allowDevMockAuth:
      parsed.data.ALLOW_DEV_MOCK_AUTH === 'true' || parsed.data.ALLOW_DEV_MOCK_AUTH === '1',
    googleClientId: parsed.data.GOOGLE_CLIENT_ID,
    firebaseProjectId: parsed.data.FIREBASE_PROJECT_ID,
    githubClientId: parsed.data.GITHUB_CLIENT_ID,
    githubClientSecret: parsed.data.GITHUB_CLIENT_SECRET,
  };
}
