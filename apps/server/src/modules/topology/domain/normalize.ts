import type {
  NodeId,
  NodeKind,
  NormalizationNote,
  Topology,
  TopologyDraft,
  TopologyEdge,
  TopologyNode,
  TopologyProblem,
} from '@chaosboard/contracts';
import { edgeIdSchema, topologyIdSchema } from '@chaosboard/contracts';
import { err, ok, type Result } from '@chaosboard/shared';
import { createNaiveNode, naiveEdgePolicy } from './defaults';
import { topologyProblem } from './problem';
import { slugify, uniqueSlug } from './slug';

export interface DraftBuild {
  readonly topology: Topology;
  readonly notes: readonly NormalizationNote[];
}

/**
 * Turns a loosely specified draft into a topology with naive default policies. Nothing is
 * changed silently: every dropped edge, resolved id collision, defaulted kind or mode, and
 * inferred entry is reported as a note. The result still has to pass full validation, which the
 * application layer runs, because a draft may describe more nodes than the catalog allows or
 * rules that only a complete topology can break.
 */
export function buildTopologyFromDraft(
  draft: TopologyDraft,
): Result<DraftBuild, TopologyProblem[]> {
  const notes: NormalizationNote[] = [];

  const seenRefs = new Set<string>();
  const duplicateRefs: TopologyProblem[] = [];
  for (const draftNode of draft.nodes) {
    if (seenRefs.has(draftNode.ref)) {
      duplicateRefs.push(
        topologyProblem(
          'duplicate_node_id',
          `The draft uses the node reference "${draftNode.ref}" more than once, so edges that mention it are ambiguous.`,
          { nodeId: draftNode.ref },
        ),
      );
    }
    seenRefs.add(draftNode.ref);
  }
  if (duplicateRefs.length > 0) {
    return err(duplicateRefs);
  }

  const takenNodeIds = new Set<string>();
  const nodeIdByRef = new Map<string, NodeId>();
  const nodes: TopologyNode[] = [];
  for (const draftNode of draft.nodes) {
    const base = slugify(draftNode.label, 'node');
    const id = uniqueSlug(base, takenNodeIds);
    takenNodeIds.add(id);
    if (id !== base) {
      notes.push({
        code: 'node_id_collision_resolved',
        message: `Label "${draftNode.label}" produced the id "${base}", which was taken, so "${id}" was used.`,
        ref: draftNode.ref,
      });
    }
    let kind: NodeKind;
    if (draftNode.kind === undefined) {
      kind = 'service';
      notes.push({
        code: 'node_kind_defaulted',
        message: `Node "${draftNode.label}" had no kind, so it was treated as a service.`,
        ref: draftNode.ref,
      });
    } else {
      kind = draftNode.kind;
    }
    const node = createNaiveNode(kind, id, draftNode.label);
    nodeIdByRef.set(draftNode.ref, node.id);
    nodes.push(node);
  }
  const nodeById = new Map<string, TopologyNode>(nodes.map((node) => [node.id, node]));

  const takenEdgeIds = new Set<string>();
  const seenPairs = new Set<string>();
  const edges: TopologyEdge[] = [];
  for (const draftEdge of draft.edges) {
    const edgeRef = `${draftEdge.sourceRef} -> ${draftEdge.targetRef}`;
    const sourceId = nodeIdByRef.get(draftEdge.sourceRef);
    const targetId = nodeIdByRef.get(draftEdge.targetRef);
    if (sourceId === undefined || targetId === undefined) {
      notes.push({
        code: 'edge_dropped_unknown_endpoint',
        message: `Edge ${edgeRef} was dropped because an endpoint does not match any node reference.`,
        ref: edgeRef,
      });
      continue;
    }
    if (sourceId === targetId) {
      notes.push({
        code: 'edge_dropped_self_loop',
        message: `Edge ${edgeRef} was dropped because it connects a node to itself.`,
        ref: edgeRef,
      });
      continue;
    }
    const pairKey = `${sourceId}\u0000${targetId}`;
    if (seenPairs.has(pairKey)) {
      notes.push({
        code: 'edge_dropped_duplicate_pair',
        message: `Edge ${edgeRef} was dropped because that connection was already present.`,
        ref: edgeRef,
      });
      continue;
    }
    seenPairs.add(pairKey);

    const targetNode = nodeById.get(targetId);
    let mode = draftEdge.mode;
    if (mode === undefined) {
      if (targetNode?.kind === 'queue_consumer') {
        mode = 'async_enqueue';
        notes.push({
          code: 'edge_mode_defaulted',
          message: `Edge ${edgeRef} had no mode and its target is a queue consumer, so it was set to async_enqueue.`,
          ref: edgeRef,
        });
      } else {
        mode = 'sync_call';
      }
    }

    const edgeId = uniqueSlug(slugify(`${sourceId}-to-${targetId}`, 'edge'), takenEdgeIds);
    takenEdgeIds.add(edgeId);
    edges.push({
      id: edgeIdSchema.parse(edgeId),
      source: sourceId,
      target: targetId,
      mode,
      policy: naiveEdgePolicy(),
    });
  }

  const entryResult = chooseEntry(draft, nodeIdByRef, nodes, edges, notes);
  if (!entryResult.ok) {
    return entryResult;
  }

  const topology: Topology = {
    schemaVersion: 1,
    id: topologyIdSchema.parse(slugify(draft.name, 'topology')),
    name: draft.name,
    source: draft.source,
    entry: { nodeId: entryResult.value },
    nodes,
    edges,
  };
  return ok({ topology, notes });
}

function chooseEntry(
  draft: TopologyDraft,
  nodeIdByRef: ReadonlyMap<string, NodeId>,
  nodes: readonly TopologyNode[],
  edges: readonly TopologyEdge[],
  notes: NormalizationNote[],
): Result<TopologyNode['id'], TopologyProblem[]> {
  if (draft.entryRef !== undefined) {
    const entryId = nodeIdByRef.get(draft.entryRef);
    const entryNode = nodes.find((node) => node.id === entryId);
    if (entryNode === undefined) {
      return err([
        topologyProblem(
          'unknown_entry_node',
          `The draft names "${draft.entryRef}" as the entry, but no node has that reference.`,
          { nodeId: draft.entryRef },
        ),
      ]);
    }
    return ok(entryNode.id);
  }

  const hasIncoming = new Set<string>(edges.map((edge) => edge.target));
  const candidates = nodes.filter(
    (node) => !hasIncoming.has(node.id) && node.kind !== 'queue_consumer',
  );
  const [only] = candidates;
  if (candidates.length === 1 && only !== undefined) {
    notes.push({
      code: 'entry_inferred',
      message: `"${only.label}" is the only node without incoming edges, so it was chosen as the entry.`,
      ref: only.id,
    });
    return ok(only.id);
  }
  const names = candidates.map((node) => `"${node.label}"`).join(', ');
  return err([
    topologyProblem(
      'unknown_entry_node',
      candidates.length === 0
        ? 'No entry node could be inferred because every node has incoming edges. Name the entry explicitly.'
        : `The entry could not be inferred because several nodes have no incoming edges (${names}). Name the entry explicitly.`,
    ),
  ]);
}
