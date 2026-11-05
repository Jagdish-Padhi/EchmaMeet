import { describe, expect, it } from 'vitest';
import { catalog } from '../../packages/contracts/src/catalog';
import { replaceBlock } from './blocks';
import { renderCatalogTable } from './catalog-table';

describe('renderCatalogTable', () => {
  it('has one row for every catalog entry', () => {
    const entries = Object.values(catalog).reduce(
      (count, section) => count + Object.keys(section).length,
      0,
    );
    const rows = renderCatalogTable().split('\n').slice(2);
    expect(rows).toHaveLength(entries);
  });

  it('shows the real minimum and maximum of a bound', () => {
    expect(renderCatalogTable()).toContain(
      `| \`edge.maxAttempts\` | ${String(catalog.edge.maxAttempts.min)} | ${String(catalog.edge.maxAttempts.max)} |`,
    );
  });

  it('shows scalar limits as a maximum with no minimum', () => {
    expect(renderCatalogTable()).toContain(`| \`topology.maxNodes\` | | ${String(catalog.topology.maxNodes)} |`);
  });
});

describe('replaceBlock', () => {
  it('rewrites only the text between the markers', () => {
    const result = replaceBlock('a\n<!-- x:start -->\nold\n<!-- x:end -->\nb', 'x', 'new');
    expect(result).toBe('a\n<!-- x:start -->\nnew\n<!-- x:end -->\nb');
  });

  it('is idempotent', () => {
    const once = replaceBlock('<!-- x:start -->\n<!-- x:end -->', 'x', 'body');
    expect(replaceBlock(once, 'x', 'body')).toBe(once);
  });

  it('refuses a document without both markers', () => {
    expect(() => replaceBlock('nothing', 'x', 'body')).toThrow(/x:start/);
  });
});
