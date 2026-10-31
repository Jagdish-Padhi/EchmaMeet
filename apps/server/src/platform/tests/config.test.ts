import { describe, expect, it } from 'vitest';
import { ConfigError, loadSettings } from '../config';

describe('loadSettings', () => {
  it('applies documented defaults when nothing is set', () => {
    const settings = loadSettings({});
    expect(settings).toEqual({
      nodeEnv: 'development',
      host: '127.0.0.1',
      port: 8787,
      dataDir: './data',
      logLevel: 'info',
      databaseUrl: '',
      redisUrl: '',
      toxiproxyUrl: 'http://127.0.0.1:8474',
      partnerBaseUrl: 'http://127.0.0.1:8000/v1',
      partnerApiKey: '',
      partnerModelId: 'meta-models/muse-spark-open-1026',
      jwtSecret: 'chaosboard-default-jwt-secret-replace-in-production-2026',
      jwtExpiresIn: 1209600,
      googleClientId: '',
      firebaseProjectId: '',
      githubClientId: '',
      githubClientSecret: '',
    });
  });

  it('reads and coerces values from the environment', () => {
    const settings = loadSettings({
      NODE_ENV: 'production',
      SERVER_HOST: '0.0.0.0',
      SERVER_PORT: '9000',
      DATA_DIR: '/var/lib/chaosboard',
      LOG_LEVEL: 'debug',
    });
    expect(settings.port).toBe(9000);
    expect(settings.nodeEnv).toBe('production');
    expect(settings.logLevel).toBe('debug');
  });

  it('treats empty strings as unset', () => {
    expect(loadSettings({ SERVER_PORT: '' }).port).toBe(8787);
  });

  it('names the offending variable when a value is malformed', () => {
    try {
      loadSettings({ SERVER_PORT: 'not-a-port' });
      expect.unreachable('loadSettings should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).variables).toContain('SERVER_PORT');
      expect((error as ConfigError).message).toContain('SERVER_PORT');
    }
  });

  it('rejects out-of-range ports and unknown log levels', () => {
    expect(() => loadSettings({ SERVER_PORT: '70000' })).toThrow(ConfigError);
    expect(() => loadSettings({ LOG_LEVEL: 'loud' })).toThrow(ConfigError);
  });

  it('ignores unrelated environment variables', () => {
    expect(() => loadSettings({ PATH: '/usr/bin', HOME: '/root' })).not.toThrow();
  });
});
