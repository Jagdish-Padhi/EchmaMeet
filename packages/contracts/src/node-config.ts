import { z } from 'zod';
import { edgeIdSchema, nodeIdSchema, topologyIdSchema } from './ids';
import { edgeModeSchema, edgePolicySchema, nodeSchema } from './topology';

export const nodeOutgoingEdgeSchema = z.strictObject({
  edgeId: edgeIdSchema,
  targetNodeId: nodeIdSchema,
  targetUrl: z.url(),
  mode: edgeModeSchema,
  policy: edgePolicySchema,
});
export type NodeOutgoingEdge = z.infer<typeof nodeOutgoingEdgeSchema>;

export const nodeConfigSchema = z.strictObject({
  schemaVersion: z.literal(1),
  nodeId: nodeIdSchema,
  topologyId: topologyIdSchema,
  listenHost: z.string().min(1),
  listenPort: z.number().int().min(1024).max(65535),
  node: nodeSchema,
  outgoingEdges: z.array(nodeOutgoingEdgeSchema),
  seed: z.number().int().min(0).max(0xffffffff),
  sampleIntervalMs: z.number().int().min(10).max(5000),
});
export type NodeConfig = z.infer<typeof nodeConfigSchema>;
