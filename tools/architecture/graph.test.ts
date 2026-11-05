import { describe, expect, it } from 'vitest';
import { generateGraph, replaceGraphBlock } from './graph';

describe('module graph', () => {
  it('is deterministic for the same source tree', async () => {
    expect(await generateGraph()).toBe(await generateGraph());
  });

  it('shows workspaces and modules as nodes', async () => {
    const graph = await generateGraph();
    expect(graph).toContain('flowchart');
    expect(graph).toContain('["contracts"]');
    expect(graph).toContain('["topology"]');
    expect(graph).toContain('["platform"]');
  });

  it('replaces only the marked block of a document', () => {
    const document = 'before\n<!-- graph:start -->\nold\n<!-- graph:end -->\nafter\n';
    const updated = replaceGraphBlock(document, 'flowchart LR\n  a --> b');
    expect(updated.startsWith('before\n')).toBe(true);
    expect(updated.endsWith('\nafter\n')).toBe(true);
    expect(updated).toContain('flowchart LR\n  a --> b');
    expect(updated).not.toContain('old');
  });

  it('refuses a document without markers', () => {
    expect(() => replaceGraphBlock('no markers here', 'x')).toThrow(/graph:start/);
  });
});
