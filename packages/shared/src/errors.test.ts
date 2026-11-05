import { describe, expect, it } from 'vitest';
import { AppError, isAppError } from './errors';

describe('AppError', () => {
  it('carries kind, code, message, and details', () => {
    const error = new AppError('validation', 'bad_input', 'Input is invalid', {
      details: { field: 'name' },
    });
    expect(error.kind).toBe('validation');
    expect(error.code).toBe('bad_input');
    expect(error.message).toBe('Input is invalid');
    expect(error.details).toEqual({ field: 'name' });
    expect(error).toBeInstanceOf(Error);
  });

  it('preserves the original error as the cause', () => {
    const original = new Error('socket closed');
    const error = new AppError('unavailable', 'upstream_failed', 'Upstream failed', {
      cause: original,
    });
    expect(error.cause).toBe(original);
  });

  it('is recognised by isAppError and not confused with plain errors', () => {
    expect(isAppError(new AppError('internal', 'x', 'x'))).toBe(true);
    expect(isAppError(new Error('x'))).toBe(false);
    expect(isAppError('x')).toBe(false);
  });
});
