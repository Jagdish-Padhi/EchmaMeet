import { pino, type Logger } from 'pino';
import type { Settings } from './config';

export type { Logger } from 'pino';

/** Structured JSON logs. Credentials are redacted wherever they could appear in a log object. */
export function createLogger(settings: Pick<Settings, 'logLevel' | 'nodeEnv'>): Logger {
  return pino({
    level: settings.logLevel,
    base: { service: 'chaosboard-server' },
    redact: {
      paths: [
        'req.headers.authorization',
        'headers.authorization',
        'apiKey',
        '*.apiKey',
        'authorization',
      ],
      censor: '[redacted]',
    },
  });
}
