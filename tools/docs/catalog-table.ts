import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { catalog } from '../../packages/contracts/src/catalog';
import { replaceBlock } from './blocks';

const docPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'contracts.md');

function isBound(value: unknown): value is { min: number; max: number } {
  return typeof value === 'object' && value !== null && 'min' in value && 'max' in value;
}

/** Renders every entry of the catalog as a markdown table, straight from the code. */
export function renderCatalogTable(): string {
  const rows: string[] = ['| Setting | Minimum | Maximum |', '|---|---|---|'];
  for (const [section, entries] of Object.entries(catalog)) {
    for (const [name, value] of Object.entries(entries)) {
      if (isBound(value)) {
        rows.push(`| \`${section}.${name}\` | ${String(value.min)} | ${String(value.max)} |`);
      } else {
        rows.push(`| \`${section}.${name}\` | | ${String(value)} |`);
      }
    }
  }
  return rows.join('\n');
}

export function syncCatalogBlock(document: string): string {
  return replaceBlock(document, 'catalog', renderCatalogTable());
}

function main(): void {
  const check = process.argv.includes('--check');
  const current = readFileSync(docPath, 'utf8');
  const updated = syncCatalogBlock(current);
  if (check) {
    if (updated !== current) {
      console.error('docs/contracts.md is out of date with the catalog. Run `pnpm docs:sync`.');
      process.exit(1);
    }
    console.log('docs/contracts.md matches the catalog.');
    return;
  }
  writeFileSync(docPath, updated);
  console.log('docs/contracts.md catalog table written.');
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
