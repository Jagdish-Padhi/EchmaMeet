import { describe, expect, it } from 'vitest';
import { collectSecrets, createRedactor, truncate } from './redact';

describe('collectSecrets', () => {
  it('picks values of credential-like variables and ignores short or unrelated ones', () => {
    const secrets = collectSecrets({
      PARTNER_API_KEY: 'sk-live-1234567890',
      META_API_KEY: 'short',
      SERVER_PORT: '8787',
      SOME_TOKEN: 'tok_abcdefghijkl',
      EMPTY_SECRET: undefined,
    });
    expect(secrets).toEqual(['sk-live-1234567890', 'tok_abcdefghijkl']);
  });
});

describe('createRedactor', () => {
  const redactor = createRedactor(['sk-live-1234567890']);

  it('removes secret values wherever they appear in text', () => {
    expect(redactor.text('Bearer sk-live-1234567890 and sk-live-1234567890')).toBe(
      'Bearer [redacted] and [redacted]',
    );
  });

  it('redacts sensitive headers by name regardless of case and scrubs the rest', () => {
    const result = redactor.headers({
      Authorization: 'Bearer abc',
      'X-Api-Key': 'abc',
      'content-type': 'application/json',
      'x-echo': 'sk-live-1234567890',
    });
    expect(result['Authorization']).toBe('[redacted]');
    expect(result['X-Api-Key']).toBe('[redacted]');
    expect(result['content-type']).toBe('application/json');
    expect(result['x-echo']).toBe('[redacted]');
  });
});

describe('truncate', () => {
  it('leaves short text alone and marks truncation on long text', () => {
    expect(truncate('abc', 10)).toBe('abc');
    expect(truncate('abcdefghij', 4)).toContain('[truncated 6 characters]');
  });
});
