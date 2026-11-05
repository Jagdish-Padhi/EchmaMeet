import { describe, expect, it } from 'vitest';
import { findCycle, reachableFrom } from '../../domain/graph';

describe('findCycle', () => {
  it('returns null for an acyclic graph', () => {
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'a', to: 'c' },
    ];
    expect(findCycle(['a', 'b', 'c'], edges)).toBeNull();
  });

  it('finds a cycle and returns it as a closed path', () => {
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'b' },
    ];
    expect(findCycle(['a', 'b', 'c'], edges)).toEqual(['b', 'c', 'b']);
  });

  it('finds a cycle that does not include the first node', () => {
    const edges = [
      { from: 'x', to: 'y' },
      { from: 'y', to: 'z' },
      { from: 'z', to: 'y' },
    ];
    const cycle = findCycle(['x', 'y', 'z'], edges);
    expect(cycle).not.toBeNull();
    expect(cycle?.[0]).toBe(cycle?.[cycle.length - 1]);
  });

  it('handles an empty graph', () => {
    expect(findCycle([], [])).toBeNull();
  });
});

describe('reachableFrom', () => {
  const edges = [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
    { from: 'd', to: 'c' },
  ];

  it('includes the start node and everything downstream', () => {
    expect([...reachableFrom('a', edges)].sort()).toEqual(['a', 'b', 'c']);
  });

  it('does not follow edges backwards', () => {
    expect([...reachableFrom('c', edges)]).toEqual(['c']);
  });

  it('terminates on cyclic input', () => {
    const cyclic = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
    ];
    expect([...reachableFrom('a', cyclic)].sort()).toEqual(['a', 'b']);
  });
});
