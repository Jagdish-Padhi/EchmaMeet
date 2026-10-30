import { z } from 'zod';
import { topologySchema } from './topology';

/** Every way a topology can be rejected. The set is closed so that clients can switch on it. */
export const topologyProblemCodeSchema = z.enum([
  'schema_violation',
  'duplicate_node_id',
  'duplicate_edge_id',
  'unknown_edge_endpoint',
  'self_loop',
  'duplicate_edge_pair',
  'unknown_entry_node',
  'entry_is_queue_consumer',
  'cycle_detected',
  'unreachable_node',
  'async_edge_target_not_consumer',
  'consumer_requires_async_edge',
  'ledger_has_outgoing_edge',
  'stale_fallback_requires_cache_source',
]);
export type TopologyProblemCode = z.infer<typeof topologyProblemCodeSchema>;

export const topologyProblemSchema = z.strictObject({
  code: topologyProblemCodeSchema,
  message: z.string().min(1),
  nodeId: z.string().optional(),
  edgeId: z.string().optional(),
  path: z.array(z.union([z.string(), z.number()])).optional(),
});
export type TopologyProblem = z.infer<typeof topologyProblemSchema>;

export const validateTopologyResponseSchema = z.discriminatedUnion('valid', [
  z.strictObject({ valid: z.literal(true), topology: topologySchema }),
  z.strictObject({ valid: z.literal(false), problems: z.array(topologyProblemSchema).min(1) }),
]);
export type ValidateTopologyResponse = z.infer<typeof validateTopologyResponseSchema>;
