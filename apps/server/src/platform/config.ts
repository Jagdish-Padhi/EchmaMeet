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
  GNANI_API_KEY: z.string().default(''),
  GNANI_BASE_URL: z.url().default('https://api.vachana.ai'),
  GNANI_STT_MODEL: z.enum(['prisma-v3.0', 'prisma-v2.5']).default('prisma-v3.0'),
  GNANI_TTS_MODEL: z.enum(['timbre-v2.5', 'timbre-v3.0']).default('timbre-v2.5'),
  GNANI_TTS_SAMPLE_RATE: z.coerce.number().int().min(8000).max(48000).default(48000),
  EVON_BASE_URL: z.string().default(''),
  EVON_API_KEY: z.string().default(''),
  EVON_MODEL_ID: z.string().default('gnani-evon-v3.3'),
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
  readonly gnaniApiKey: string;
  readonly gnaniBaseUrl: string;
  readonly gnaniSttModel: 'prisma-v3.0' | 'prisma-v2.5';
  readonly gnaniTtsModel: 'timbre-v2.5' | 'timbre-v3.0';
  readonly gnaniTtsSampleRate: number;
  /** Optional OpenAI-compatible endpoint serving open-weight Gnani Evon. Empty means rules only. */
  readonly evonBaseUrl: string;
  readonly evonApiKey: string;
  readonly evonModelId: string;
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
    gnaniApiKey: parsed.data.GNANI_API_KEY.trim(),
    gnaniBaseUrl: parsed.data.GNANI_BASE_URL.replace(/\/$/, ''),
    gnaniSttModel: parsed.data.GNANI_STT_MODEL,
    gnaniTtsModel: parsed.data.GNANI_TTS_MODEL,
    gnaniTtsSampleRate: parsed.data.GNANI_TTS_SAMPLE_RATE,
    evonBaseUrl: parsed.data.EVON_BASE_URL.trim(),
    evonApiKey: parsed.data.EVON_API_KEY.trim(),
    evonModelId: parsed.data.EVON_MODEL_ID,
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
