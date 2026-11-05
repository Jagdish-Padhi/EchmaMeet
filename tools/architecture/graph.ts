import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cruise, format, type ICruiseOptions } from 'dependency-cruiser';
import extractDepcruiseConfig from 'dependency-cruiser/config-utl/extract-depcruise-config';
import { replaceBlock } from '../docs/blocks';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const docPath = join(repoRoot, 'docs', 'architecture.md');

/** Workspaces and server modules collapsed to one node each. */
const COLLAPSE =
  '^(apps/server/src/modules/[^/]+|apps/server/src/platform|apps/[^/]+|packages/[^/]+|scripts)';

/** Builds the module-level dependency graph as Mermaid text from the real source tree. */
export async function generateGraph(root: string = repoRoot): Promise<string> {
  const config = (await extractDepcruiseConfig(join(root, '.dependency-cruiser.cjs'))) as {
    options?: ICruiseOptions;
  };
  const options: ICruiseOptions = {
    ...config.options,
    baseDir: root,
    includeOnly: '^(apps|packages|scripts)/',
    exclude: { path: ['\\.test\\.tsx?$', '/tests/', '/dist/', 'vite\\.config', 'vitest'] },
    collapse: COLLAPSE,
  };
  const result = await cruise(['apps', 'packages', 'scripts'], options);
  if (typeof result.output === 'string') {
    throw new Error('Expected structured cruise output.');
  }
  const formatted = await format(result.output, { outputType: 'mermaid' });
  if (typeof formatted.output !== 'string') {
    throw new Error('Expected text output from the mermaid reporter.');
  }
  return formatted.output.trim();
}

export function replaceGraphBlock(document: string, mermaid: string): string {
  return replaceBlock(
    document,
    'graph',
    `\`\`\`mermaid
${mermaid}
\`\`\``,
  );
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const current = readFileSync(docPath, 'utf8');
  const updated = replaceGraphBlock(current, await generateGraph());
  if (check) {
    if (updated !== current) {
      console.error('docs/architecture.md has a stale module graph. Run `pnpm graph` and commit.');
      process.exit(1);
    }
    console.log('Module graph is current.');
    return;
  }
  writeFileSync(docPath, updated);
  console.log('Module graph written to docs/architecture.md.');
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
