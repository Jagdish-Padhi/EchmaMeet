import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health';
import { problemDetailsSchema } from './problem-details';

describe('healthResponseSchema', () => {
  it('accepts a healthy response', () => {
    const result = healthResponseSchema.safeParse({
      status: 'ok',
      service: 'chaosboard-server',
      nodeVersion: 'v22.22.2',
      checks: { database: 'ok' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown status', () => {
    const result = healthResponseSchema.safeParse({
      status: 'great',
      service: 'chaosboard-server',
      nodeVersion: 'v22.22.2',
      checks: { database: 'ok' },
    });
    expect(result.success).toBe(false);
  });
});

describe('problemDetailsSchema', () => {
  it('accepts a problem with field errors', () => {
    const result = problemDetailsSchema.safeParse({
      type: 'about:blank',
      title: 'Validation failed',
      status: 400,
      code: 'validation_failed',
      errors: [{ path: 'nodes.0.id', message: 'must be a slug' }],
    });
    expect(result.success).toBe(true);
  });

  it('requires a machine-readable code', () => {
    const result = problemDetailsSchema.safeParse({
      type: 'about:blank',
      title: 'Validation failed',
      status: 400,
    });
    expect(result.success).toBe(false);
  });
});
