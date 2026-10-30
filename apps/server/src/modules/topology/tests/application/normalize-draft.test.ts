import { describe, expect, it } from 'vitest';
import { normalizeTopologyDraft } from '../../application/normalize-draft';

function draft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Shop',
    source: 'image',
    nodes: [
      { ref: 'n1', label: 'Gateway', kind: 'service' },
      { ref: 'n2', label: 'Orders', kind: 'service' },
    ],
    edges: [{ sourceRef: 'n1', targetRef: 'n2' }],
    ...overrides,
  };
}

describe('normalizeTopologyDraft', () => {
  it('turns a clean draft into a valid topology with naive defaults and an inferred entry', () => {
    const result = normalizeTopologyDraft(draft());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.topology.entry.nodeId).toBe('gateway');
    expect(result.value.topology.edges).toHaveLength(1);
    expect(result.value.topology.edges[0]?.policy.retry.maxAttempts).toBe(3);
    expect(result.value.topology.source).toBe('image');
    expect(result.value.notes.map((note) => note.code)).toEqual(['entry_inferred']);
  });

  it('resolves label collisions and reports them', () => {
    const result = normalizeTopologyDraft(
      draft({
        nodes: [
          { ref: 'n1', label: 'API', kind: 'service' },
          { ref: 'n2', label: 'api', kind: 'service' },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.topology.nodes.map((node) => node.id)).toEqual(['api', 'api-2']);
    expect(result.value.notes.some((note) => note.code === 'node_id_collision_resolved')).toBe(
      true,
    );
  });

  it('defaults a missing kind to service and says so', () => {
    const result = normalizeTopologyDraft(
      draft({
        nodes: [
          { ref: 'n1', label: 'Gateway' },
          { ref: 'n2', label: 'Orders' },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.notes.filter((note) => note.code === 'node_kind_defaulted')).toHaveLength(
      2,
    );
  });

  it('drops impossible edges and reports each one', () => {
    const result = normalizeTopologyDraft(
      draft({
        edges: [
          { sourceRef: 'n1', targetRef: 'n2' },
          { sourceRef: 'n1', targetRef: 'missing' },
          { sourceRef: 'n2', targetRef: 'n2' },
          { sourceRef: 'n1', targetRef: 'n2' },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.topology.edges).toHaveLength(1);
    const codes = result.value.notes.map((note) => note.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'edge_dropped_unknown_endpoint',
        'edge_dropped_self_loop',
        'edge_dropped_duplicate_pair',
      ]),
    );
  });

  it('makes edges into a queue consumer asynchronous and reports the default', () => {
    const result = normalizeTopologyDraft(
      draft({
        nodes: [
          { ref: 'n1', label: 'Api', kind: 'service' },
          { ref: 'n2', label: 'Consumer', kind: 'queue_consumer' },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.topology.edges[0]?.mode).toBe('async_enqueue');
    expect(result.value.notes.some((note) => note.code === 'edge_mode_defaulted')).toBe(true);
  });

  it('uses an explicit entry reference', () => {
    const result = normalizeTopologyDraft(
      draft({ entryRef: 'n1', edges: [{ sourceRef: 'n1', targetRef: 'n2' }] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.notes.some((note) => note.code === 'entry_inferred')).toBe(false);
  });

  it('refuses to guess an entry when several nodes have no incoming edges', () => {
    const result = normalizeTopologyDraft(draft({ edges: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error[0]?.code).toBe('unknown_entry_node');
  });

  it('refuses an entry reference that matches no node', () => {
    const result = normalizeTopologyDraft(draft({ entryRef: 'ghost' }));
    expect(result.ok).toBe(false);
  });

  it('rejects duplicate node references instead of silently merging them', () => {
    const result = normalizeTopologyDraft(
      draft({
        nodes: [
          { ref: 'n1', label: 'A', kind: 'service' },
          { ref: 'n1', label: 'B', kind: 'service' },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error[0]?.code).toBe('duplicate_node_id');
  });

  it('reports a schema violation for a malformed draft', () => {
    const result = normalizeTopologyDraft({ name: '', source: 'image', nodes: [], edges: [] });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.every((problem) => problem.code === 'schema_violation')).toBe(true);
  });

  it('runs full validation on the built topology', () => {
    const result = normalizeTopologyDraft(
      draft({
        nodes: [
          { ref: 'n1', label: 'A', kind: 'service' },
          { ref: 'n2', label: 'B', kind: 'service' },
          { ref: 'n3', label: 'C', kind: 'service' },
        ],
        entryRef: 'n1',
        edges: [
          { sourceRef: 'n1', targetRef: 'n2' },
          { sourceRef: 'n2', targetRef: 'n3' },
          { sourceRef: 'n3', targetRef: 'n2' },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.map((problem) => problem.code)).toContain('cycle_detected');
  });
});
