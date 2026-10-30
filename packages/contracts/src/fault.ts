import { z } from 'zod';
import { boundedInt } from './bounded';
import { catalog } from './catalog';
import { edgeIdSchema, faultIdSchema } from './ids';

const { fault: bounds } = catalog;

/**
 * Faults use ChaosBoard's own vocabulary. The chaos module maps each kind to whatever the
 * running Toxiproxy server supports and rejects a fault it cannot express. Parameter names here
 * are therefore deliberately independent of any provider's attribute names.
 */
const faultCommonShape = {
  id: faultIdSchema,
  edgeId: edgeIdSchema,
  /** Fraction of connections affected, in (0, 1]. */
  toxicity: z.number().gt(0).max(1),
  direction: z.enum(['upstream', 'downstream']),
  startOffsetMs: boundedInt(bounds.startOffsetMs),
};

export const faultSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...faultCommonShape,
    type: z.literal('latency'),
    latencyMs: boundedInt(bounds.latencyMs),
    jitterMs: boundedInt(bounds.jitterMs),
  }),
  z.strictObject({
    ...faultCommonShape,
    type: z.literal('stall'),
    /** Null means the connection stays stalled until the fault is cleared. */
    holdMs: boundedInt(bounds.stallHoldMs).nullable(),
  }),
  z.strictObject({
    ...faultCommonShape,
    type: z.literal('connection_reset'),
    afterMs: boundedInt(bounds.resetAfterMs),
  }),
  z.strictObject({
    ...faultCommonShape,
    type: z.literal('slow_close'),
    delayMs: boundedInt(bounds.slowCloseDelayMs),
  }),
  z.strictObject({
    ...faultCommonShape,
    type: z.literal('bandwidth_limit'),
    rateKbPerSec: boundedInt(bounds.bandwidthKbPerSec),
  }),
  z.strictObject({
    ...faultCommonShape,
    type: z.literal('data_limit'),
    maxBytes: boundedInt(bounds.dataLimitBytes),
  }),
  z
    .strictObject({ ...faultCommonShape, type: z.literal('dependency_down') })
    .refine((fault) => fault.toxicity === 1, {
      message: 'dependency_down affects every connection, so toxicity must be 1',
      path: ['toxicity'],
    }),
]);
export type Fault = z.infer<typeof faultSchema>;
export type FaultType = Fault['type'];
