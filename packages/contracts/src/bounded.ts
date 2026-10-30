import { z } from 'zod';
import type { Bound } from './catalog';

/** An integer constrained to a catalog bound. */
export function boundedInt(range: Bound): z.ZodNumber {
  return z.number().int().min(range.min).max(range.max);
}

/** A finite number constrained to a catalog bound. */
export function boundedNumber(range: Bound): z.ZodNumber {
  return z.number().min(range.min).max(range.max);
}
