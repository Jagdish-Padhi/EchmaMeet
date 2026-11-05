import { describe, it, expect } from 'vitest';
import { generateSchedule } from './schedule';

describe('generateSchedule', () => {
  it('generates deterministic schedule with constant spacing', () => {
    const s1 = generateSchedule({
      arrivalProcess: 'constant',
      arrivalRateRps: 10,
      warmupDurationMs: 200,
      measurementDurationMs: 1000,
      cooldownDurationMs: 200,
      seed: 42,
    });

    const s2 = generateSchedule({
      arrivalProcess: 'constant',
      arrivalRateRps: 10,
      warmupDurationMs: 200,
      measurementDurationMs: 1000,
      cooldownDurationMs: 200,
      seed: 42,
    });

    expect(s1).toEqual(s2);
    expect(s1.length).toBe(13); // 1400ms total / 100ms interval = 13 items strictly < 1400ms

    // Check phases
    const warmupItems = s1.filter((i) => i.phase === 'warmup');
    const measurementItems = s1.filter((i) => i.phase === 'measurement');
    const cooldownItems = s1.filter((i) => i.phase === 'cooldown');

    expect(warmupItems.length).toBe(1); // at 100ms
    expect(measurementItems.length).toBe(10); // 200ms to 1100ms
    expect(cooldownItems.length).toBe(2); // 1200ms, 1300ms
  });

  it('generates reproducible Poisson arrival schedule from seed', () => {
    const s1 = generateSchedule({
      arrivalProcess: 'poisson',
      arrivalRateRps: 50,
      warmupDurationMs: 100,
      measurementDurationMs: 500,
      cooldownDurationMs: 100,
      seed: 1234,
    });

    const s2 = generateSchedule({
      arrivalProcess: 'poisson',
      arrivalRateRps: 50,
      warmupDurationMs: 100,
      measurementDurationMs: 500,
      cooldownDurationMs: 100,
      seed: 1234,
    });

    expect(s1).toEqual(s2);
    expect(s1.length).toBeGreaterThan(20);

    // Different seed produces different schedule
    const s3 = generateSchedule({
      arrivalProcess: 'poisson',
      arrivalRateRps: 50,
      warmupDurationMs: 100,
      measurementDurationMs: 500,
      cooldownDurationMs: 100,
      seed: 5678,
    });

    expect(s1).not.toEqual(s3);
  });
});
