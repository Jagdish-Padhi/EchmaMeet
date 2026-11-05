import type { Processing } from '@chaosboard/contracts';
import type { RandomSource } from '@chaosboard/shared';

export function computeProcessingTimeMs(processing: Processing, random: RandomSource): number {
  if (processing.distribution === 'constant') {
    return processing.ms;
  }

  // lognormal
  if (processing.medianMs <= 0) {
    return 0;
  }

  // Box-Muller transform for standard normal variable
  // Avoid 0 for log
  const u1 = Math.max(1e-10, random.next());
  const u2 = random.next();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

  const sample = processing.medianMs * Math.exp(processing.sigma * z);
  return Math.max(0, Math.round(sample));
}

export async function simulateProcessing(
  processing: Processing,
  random: RandomSource,
): Promise<number> {
  const delayMs = computeProcessingTimeMs(processing, random);
  if (delayMs > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  }
  return delayMs;
}
