import { z } from 'zod';
import { faultSchema } from '../chaos/fault';

export const redStrokePointSchema = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
export type RedStrokePoint = z.infer<typeof redStrokePointSchema>;

export const candidateEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  polyline: z.array(redStrokePointSchema).min(2),
});
export type CandidateEdge = z.infer<typeof candidateEdgeSchema>;

export const redStrokeGestureRequestSchema = z.object({
  strokePolyline: z.array(redStrokePointSchema).min(2).optional(),
  imageKeyframe: z.string().optional(),
  candidateEdges: z.array(candidateEdgeSchema),
});
export type RedStrokeGestureRequest = z.infer<typeof redStrokeGestureRequestSchema>;

export const redStrokeIntersectionSchema = z.object({
  edgeId: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  point: redStrokePointSchema,
});
export type RedStrokeIntersection = z.infer<typeof redStrokeIntersectionSchema>;

export const redStrokeSelectionSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('selected'),
    edgeId: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    proposedFault: faultSchema,
  }),
  z.object({
    status: z.literal('ambiguous'),
    candidates: z.array(z.string()),
    message: z.string(),
  }),
  z.object({
    status: z.literal('none'),
    message: z.string(),
  }),
]);
export type RedStrokeSelection = z.infer<typeof redStrokeSelectionSchema>;

export const redStrokeDetectionResultSchema = z.object({
  detector: z.enum(['sam', 'color_threshold']),
  strokePolyline: z.array(redStrokePointSchema),
  intersections: z.array(redStrokeIntersectionSchema),
  selection: redStrokeSelectionSchema,
});
export type RedStrokeDetectionResult = z.infer<typeof redStrokeDetectionResultSchema>;
