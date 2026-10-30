import { describe, expect, it } from 'vitest';
import { findTopologyProblems } from '../../domain/validate';
import { edge, node, topology } from '../support/builders';

function codes(problems: readonly { code: string }[]): string[] {
  return problems.map((problem) => problem.code);
}

describe('findTopologyProblems', () => {
  it('accepts a simple valid chain', () => {
    const valid = topology([node('a'), node('b'), node('c')], [edge('a', 'b'), edge('b', 'c')]);
    expect(findTopologyProblems(valid)).toEqual([]);
  });

  it('accepts a diamond-shaped acyclic graph', () => {
    const valid = topology(
      [node('a'), node('b'), node('c'), node('d')],
      [edge('a', 'b'), edge('a', 'c'), edge('b', 'd'), edge('c', 'd')],
    );
    expect(findTopologyProblems(valid)).toEqual([]);
  });

  it('reports duplicate node ids and names the node', () => {
    const problems = findTopologyProblems(topology([node('a'), node('a')], []));
    expect(codes(problems)).toContain('duplicate_node_id');
    expect(problems.find((problem) => problem.code === 'duplicate_node_id')?.nodeId).toBe('a');
  });

  it('reports duplicate edge ids', () => {
    const problems = findTopologyProblems(
      topology(
        [node('a'), node('b'), node('c')],
        [edge('a', 'b', { id: 'same' }), edge('b', 'c', { id: 'same' })],
      ),
    );
    expect(codes(problems)).toContain('duplicate_edge_id');
  });

  it('reports an edge that points at a missing node and names both the edge and the node', () => {
    const problems = findTopologyProblems(topology([node('a')], [edge('a', 'ghost')]));
    const problem = problems.find((candidate) => candidate.code === 'unknown_edge_endpoint');
    expect(problem?.edgeId).toBe('a-to-ghost');
    expect(problem?.nodeId).toBe('ghost');
  });

  it('reports self loops', () => {
    const problems = findTopologyProblems(topology([node('a')], [edge('a', 'a')]));
    expect(codes(problems)).toContain('self_loop');
  });

  it('reports a second edge between the same pair', () => {
    const problems = findTopologyProblems(
      topology([node('a'), node('b')], [edge('a', 'b'), edge('a', 'b', { id: 'second' })]),
    );
    expect(codes(problems)).toContain('duplicate_edge_pair');
  });

  it('reports an unknown entry node', () => {
    const problems = findTopologyProblems(topology([node('a')], [], 'elsewhere'));
    expect(codes(problems)).toEqual(['unknown_entry_node']);
  });

  it('reports a queue consumer used as the entry', () => {
    const problems = findTopologyProblems(
      topology([node('worker', 'queue_consumer')], [], 'worker'),
    );
    expect(codes(problems)).toContain('entry_is_queue_consumer');
  });

  it('reports a cycle with the path in the message', () => {
    const problems = findTopologyProblems(
      topology([node('a'), node('b'), node('c')], [edge('a', 'b'), edge('b', 'c'), edge('c', 'b')]),
    );
    const cycle = problems.find((problem) => problem.code === 'cycle_detected');
    expect(cycle?.message).toContain('b -> c -> b');
  });

  it('reports every unreachable node', () => {
    const problems = findTopologyProblems(
      topology([node('a'), node('b'), node('island'), node('lonely')], [edge('a', 'b')]),
    );
    const unreachable = problems
      .filter((problem) => problem.code === 'unreachable_node')
      .map((problem) => problem.nodeId);
    expect(unreachable).toEqual(['island', 'lonely']);
  });

  it('requires asynchronous edges to target a queue consumer', () => {
    const problems = findTopologyProblems(
      topology([node('a'), node('b')], [edge('a', 'b', { mode: 'async_enqueue' })]),
    );
    expect(codes(problems)).toContain('async_edge_target_not_consumer');
  });

  it('requires edges into a queue consumer to be asynchronous', () => {
    const problems = findTopologyProblems(
      topology([node('a'), node('q', 'queue_consumer')], [edge('a', 'q')]),
    );
    expect(codes(problems)).toContain('consumer_requires_async_edge');
  });

  it('accepts an asynchronous edge into a queue consumer', () => {
    const valid = topology(
      [node('a'), node('q', 'queue_consumer')],
      [edge('a', 'q', { mode: 'async_enqueue' })],
    );
    expect(findTopologyProblems(valid)).toEqual([]);
  });

  it('forbids edges leaving a ledger sink', () => {
    const problems = findTopologyProblems(
      topology(
        [node('a'), node('ledger', 'ledger_sink'), node('b')],
        [edge('a', 'ledger'), edge('ledger', 'b')],
      ),
    );
    expect(codes(problems)).toContain('ledger_has_outgoing_edge');
  });

  it('allows stale-cache fallback only from a cache node', () => {
    const fromService = findTopologyProblems(
      topology(
        [node('a'), node('b')],
        [edge('a', 'b', { policy: { fallback: 'serve_stale_cache' } })],
      ),
    );
    expect(codes(fromService)).toContain('stale_fallback_requires_cache_source');

    const fromCache = findTopologyProblems(
      topology(
        [node('c', 'cache'), node('b')],
        [edge('c', 'b', { policy: { fallback: 'serve_stale_cache' } })],
      ),
    );
    expect(fromCache).toEqual([]);
  });

  it('reports several different problems at once instead of stopping at the first', () => {
    const problems = findTopologyProblems(
      topology(
        [node('a'), node('b'), node('island')],
        [edge('a', 'a'), edge('a', 'b', { mode: 'async_enqueue' })],
      ),
    );
    expect(codes(problems)).toEqual(
      expect.arrayContaining(['self_loop', 'async_edge_target_not_consumer', 'unreachable_node']),
    );
  });

  it('returns problems in a stable order', () => {
    const build = () =>
      findTopologyProblems(
        topology([node('a'), node('b'), node('x'), node('y')], [edge('a', 'a'), edge('x', 'y')]),
      );
    expect(build()).toEqual(build());
  });
});
