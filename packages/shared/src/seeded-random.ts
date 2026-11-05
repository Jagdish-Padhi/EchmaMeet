import type { RandomSource } from './ports';

const UINT32_RANGE = 0x1_0000_0000;

/**
 * Deterministic 32-bit generator (mulberry32). The same seed always yields the same sequence,
 * which is what makes arrival schedules and jitter reproducible from a recorded seed.
 * It is not cryptographically secure and must never be used for secrets or identifiers.
 */
export function createSeededRandom(seed: number): RandomSource {
  if (!Number.isInteger(seed) || seed < 0 || seed >= UINT32_RANGE) {
    throw new RangeError(`seed must be an integer in [0, 2^32), received ${String(seed)}`);
  }
  let state = seed;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
    },
  };
}

/**
 * Derives an independent child seed from a base seed and an index (for example one seed per
 * trial). Pure and deterministic.
 */
export function deriveSeed(baseSeed: number, index: number): number {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(`index must be a non-negative integer, received ${String(index)}`);
  }
  const mixer = createSeededRandom((baseSeed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  return Math.floor(mixer.next() * UINT32_RANGE);
}
