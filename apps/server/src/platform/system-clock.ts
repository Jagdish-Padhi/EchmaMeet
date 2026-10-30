import type { Clock } from '@chaosboard/shared';

export const systemClock: Clock = {
  nowMs: () => Date.now(),
  monotonicNs: () => process.hrtime.bigint(),
};
