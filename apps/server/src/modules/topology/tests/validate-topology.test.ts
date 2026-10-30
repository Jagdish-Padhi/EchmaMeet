import { describe, expect, it } from 'vitest';
import { validateTopologyInput } from '../application/validate-topology';
import { edge, node, topology } from './support/builders';

describe('validateTopologyInput', () => {
  it('returns the parsed topology when everything is valid', () => {
    const outcome = validateTopologyInput(topology([node('a'), node('b')], [edge('a', 'b')]));
    expect(outcome.valid).toBe(true);
  });

  it('reports schema violations with a readable location', () => {
    const broken = structuredClone(topology([node('a')], [])) as unknown as Record<string, unknown>;
    broken['name'] = '';
    const outcome = validateTopologyInput(broken);
    expect(outcome.valid).toBe(false);
    if (outcome.valid) {
      return;
    }
    expect(outcome.problems[0]?.code).toBe('schema_violation');
    expect(outcome.problems[0]?.message).toContain('name');
  });

  it('rejects input that is not an object', () => {
    for (const input of [null, undefined, 42, 'text', []]) {
      const outcome = validateTopologyInput(input);
      expect(outcome.valid).toBe(false);
    }
  });

  it('runs graph rules only after the schema passes', () => {
    const outcome = validateTopologyInput(topology([node('a')], [edge('a', 'ghost')]));
    expect(outcome.valid).toBe(false);
    if (outcome.valid) {
      return;
    }
    expect(outcome.problems.map((problem) => problem.code)).toContain('unknown_edge_endpoint');
  });

  it('names the node kind in a discriminator failure', () => {
    const bad = structuredClone(topology([node('a')], [])) as unknown as {
      nodes: { kind: string }[];
    };
    const first = bad.nodes[0];
    if (first !== undefined) {
      first.kind = 'database';
    }
    const outcome = validateTopologyInput(bad);
    expect(outcome.valid).toBe(false);
  });
});
