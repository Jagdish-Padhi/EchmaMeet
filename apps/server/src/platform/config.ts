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
  PARTNER_BASE_URL: z.string().default('http://127.0.0.1:8000/v1'),
  PARTNER_API_KEY: z.string().default(''),
  PARTNER_MODEL_ID: z.string().default('meta-models/muse-spark-open-1026'),
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
  readonly partnerBaseUrl: string;
  readonly partnerApiKey: string;
  readonly partnerModelId: string;
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
  return {
    nodeEnv: parsed.data.NODE_ENV,
    host: parsed.data.SERVER_HOST,
    port: parsed.data.SERVER_PORT,
    dataDir: parsed.data.DATA_DIR,
    logLevel: parsed.data.LOG_LEVEL,
    databaseUrl: parsed.data.DATABASE_URL,
    redisUrl: parsed.data.REDIS_URL,
    toxiproxyUrl: parsed.data.TOXIPROXY_URL,
    partnerBaseUrl: parsed.data.PARTNER_BASE_URL,
    partnerApiKey: parsed.data.PARTNER_API_KEY,
    partnerModelId: parsed.data.PARTNER_MODEL_ID,
  };
}
