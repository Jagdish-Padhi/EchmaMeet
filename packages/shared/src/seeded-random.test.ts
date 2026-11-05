import { describe, expect, it } from 'vitest';
import { createSeededRandom, deriveSeed } from './seeded-random';

function take(seed: number, count: number): number[] {
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, () => random.next());
}

describe('createSeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    expect(take(42, 50)).toEqual(take(42, 50));
  });

  it('produces different sequences for different seeds', () => {
    expect(take(1, 20)).not.toEqual(take(2, 20));
  });

  it('stays inside [0, 1)', () => {
    for (const value of take(7, 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('has a mean close to one half over many samples', () => {
    const values = take(123, 50_000);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(mean).toBeGreaterThan(0.49);
    expect(mean).toBeLessThan(0.51);
  });

  it('rejects seeds outside the unsigned 32-bit integer range', () => {
    expect(() => createSeededRandom(-1)).toThrow(RangeError);
    expect(() => createSeededRandom(1.5)).toThrow(RangeError);
    expect(() => createSeededRandom(2 ** 32)).toThrow(RangeError);
  });
});

describe('deriveSeed', () => {
  it('is deterministic', () => {
    expect(deriveSeed(99, 3)).toBe(deriveSeed(99, 3));
  });

  it('gives distinct seeds for distinct indices', () => {
    const seeds = new Set(Array.from({ length: 200 }, (_, index) => deriveSeed(99, index)));
    expect(seeds.size).toBe(200);
  });

  it('returns a valid seed', () => {
    const derived = deriveSeed(5, 0);
    expect(() => createSeededRandom(derived)).not.toThrow();
  });

  it('rejects invalid indices', () => {
    expect(() => deriveSeed(1, -1)).toThrow(RangeError);
    expect(() => deriveSeed(1, 0.5)).toThrow(RangeError);
  });
});
