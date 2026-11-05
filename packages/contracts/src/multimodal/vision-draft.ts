import { z } from 'zod';
import { nodeKindSchema } from '../topology/topology';
import { topologyDraftSchema } from '../topology/topology-draft';

export const visionBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});
export type VisionBox = z.infer<typeof visionBoxSchema>;

export const visionExtractedNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: nodeKindSchema.optional(),
  confidence: z.number().min(0).max(1),
  box: visionBoxSchema.optional(),
});
export type VisionExtractedNode = z.infer<typeof visionExtractedNodeSchema>;

export const visionExtractedEdgeSchema = z.object({
  id: z.string().min(1),
  sourceLabel: z.string().min(1),
  targetLabel: z.string().min(1),
  confidence: z.number().min(0).max(1),
  polyline: z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).optional(),
});
export type VisionExtractedEdge = z.infer<typeof visionExtractedEdgeSchema>;

export const visionExtractionSchema = z.object({
  nodes: z.array(visionExtractedNodeSchema),
  edges: z.array(visionExtractedEdgeSchema),
  ambiguities: z.array(z.string()),
  warnings: z.array(z.string()),
  rawModelOutput: z.string().optional(),
});
export type VisionExtraction = z.infer<typeof visionExtractionSchema>;

export const visionConfirmRequestSchema = z.object({
  draft: topologyDraftSchema.refine((d) => d.source === 'image', {
    message: "Vision confirmation draft must have source: 'image'",
  }),
});
export type VisionConfirmRequest = z.infer<typeof visionConfirmRequestSchema>;
