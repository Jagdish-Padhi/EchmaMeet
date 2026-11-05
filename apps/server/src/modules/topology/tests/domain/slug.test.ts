import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from '../../domain/slug';

describe('slugify', () => {
  it('lowercases and joins words with hyphens', () => {
    expect(slugify('Order Service', 'node')).toBe('order-service');
  });

  it('removes accents and punctuation', () => {
    expect(slugify('Café (Primary)!', 'node')).toBe('cafe-primary');
  });

  it('prefixes labels that do not start with a letter', () => {
    expect(slugify('42 workers', 'node')).toBe('n-42-workers');
  });

  it('falls back when nothing usable remains', () => {
    expect(slugify('***', 'node')).toBe('node');
    expect(slugify('', 'edge')).toBe('edge');
  });

  it('truncates to forty characters without a trailing hyphen', () => {
    const slug = slugify('a'.repeat(39) + ' b' + ' c', 'node');
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('uniqueSlug', () => {
  it('returns the slug unchanged when it is free', () => {
    expect(uniqueSlug('api', new Set())).toBe('api');
  });

  it('adds the first free numeric suffix', () => {
    expect(uniqueSlug('api', new Set(['api', 'api-2']))).toBe('api-3');
  });

  it('stays inside the length limit when adding a suffix', () => {
    const long = 'a'.repeat(40);
    const result = uniqueSlug(long, new Set([long]));
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result.endsWith('-2')).toBe(true);
  });
});
