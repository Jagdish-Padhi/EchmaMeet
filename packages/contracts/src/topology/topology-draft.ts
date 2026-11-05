import { z } from 'zod';
import { catalog } from '../common/catalog';
import { edgeModeSchema, nodeKindSchema } from './topology';

const { topology: topologyBounds } = catalog;

/**
 * A loosely specified topology, as produced by the canvas importer or by image extraction.
 * Elements refer to each other by free-form `ref` strings. Normalization turns a draft into a
 * validated topology and reports everything it had to change.
 */
export const topologyDraftSchema = z.strictObject({
  name: z.string().min(1).max(topologyBounds.nameMaxLength),
  source: z.enum(['canvas', 'image']),
  nodes: z
    .array(
      z.strictObject({
        ref: z.string().min(1).max(64),
        label: z.string().min(1).max(topologyBounds.labelMaxLength),
        kind: nodeKindSchema.optional(),
      }),
    )
    .max(topologyBounds.maxNodes * 2),
  edges: z
    .array(
      z.strictObject({
        sourceRef: z.string().min(1).max(64),
        targetRef: z.string().min(1).max(64),
        mode: edgeModeSchema.optional(),
      }),
    )
    .max(topologyBounds.maxEdges * 2),
  entryRef: z.string().min(1).max(64).optional(),
});
export type TopologyDraft = z.infer<typeof topologyDraftSchema>;

export const normalizationNoteCodeSchema = z.enum([
  'edge_dropped_unknown_endpoint',
  'edge_dropped_self_loop',
  'edge_dropped_duplicate_pair',
  'node_id_collision_resolved',
  'node_kind_defaulted',
  'edge_mode_defaulted',
  'entry_inferred',
]);
export type NormalizationNoteCode = z.infer<typeof normalizationNoteCodeSchema>;

export const normalizationNoteSchema = z.strictObject({
  code: normalizationNoteCodeSchema,
  message: z.string().min(1),
  ref: z.string().optional(),
});
export type NormalizationNote = z.infer<typeof normalizationNoteSchema>;
