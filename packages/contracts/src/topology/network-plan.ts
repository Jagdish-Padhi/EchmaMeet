import { z } from 'zod';
import { edgeIdSchema, nodeIdSchema, topologyIdSchema } from '../common/ids';

export const nodePortAllocationSchema = z.strictObject({
  nodeId: nodeIdSchema,
  port: z.number().int().min(1024).max(65535),
});
export type NodePortAllocation = z.infer<typeof nodePortAllocationSchema>;

export const edgeProxyAllocationSchema = z.strictObject({
  edgeId: edgeIdSchema,
  proxyPort: z.number().int().min(1024).max(65535),
});
export type EdgeProxyAllocation = z.infer<typeof edgeProxyAllocationSchema>;

export const networkPlanSchema = z.strictObject({
  schemaVersion: z.literal(1),
  topologyId: topologyIdSchema,
  nodes: z.array(nodePortAllocationSchema),
  edges: z.array(edgeProxyAllocationSchema),
});
export type NetworkPlan = z.infer<typeof networkPlanSchema>;
