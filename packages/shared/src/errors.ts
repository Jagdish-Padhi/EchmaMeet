/**
 * Transport-agnostic error categories. The HTTP layer maps a kind to a status code;
 * nothing in this package knows about HTTP.
 */
export type ErrorKind =
  'validation' | 'not_found' | 'conflict' | 'busy' | 'unavailable' | 'timeout' | 'internal';

export interface AppErrorOptions {
  readonly cause?: unknown;
  readonly details?: unknown;
}

/**
 * The one error type that crosses module boundaries. `code` is a stable machine-readable
 * identifier (snake_case); `message` is for humans and must not contain secrets.
 */
export class AppError extends Error {
  readonly kind: ErrorKind;
  readonly code: string;
  readonly details: unknown;

  constructor(kind: ErrorKind, code: string, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.kind = kind;
    this.code = code;
    this.details = options.details;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
