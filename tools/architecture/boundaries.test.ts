import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cruise, type ICruiseOptions, type IConfiguration } from 'dependency-cruiser';
import extractDepcruiseConfig from 'dependency-cruiser/config-utl/extract-depcruise-config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const modules = 'apps/server/src/modules';

/**
 * A throwaway source tree that deliberately breaks each boundary rule once. If a rule stops
 * firing (for example after a bad edit of the rule file), the matching case here fails, so the
 * boundary check cannot silently turn into a no-op.
 */
const files: Record<string, string> = {
  // Targets
  [`${modules}/topology/index.ts`]: "export { value } from './domain/value';",
  [`${modules}/topology/domain/value.ts`]: 'export const value = 1;',
  [`${modules}/topology/infrastructure/store.ts`]: 'export const store = 1;',
  [`${modules}/topology/http/routes.ts`]: 'export const routes = 1;',
  [`${modules}/chaos/index.ts`]: 'export const chaos = 1;',
  'apps/server/src/platform/http-kit.ts': 'export const kit = 1;',
  'apps/server/src/platform/db.ts': 'export const db = 1;',
  'apps/server/src/app.ts': 'export const app = 1;',
  'packages/shared/src/index.ts': 'export const shared = 1;',
  // Allowed: sandbox may use the public API of topology.
  [`${modules}/sandbox/application/allowed.ts`]:
    "import { value } from '../../topology/index';\nexport const ok = value;",
  // Violations
  [`${modules}/topology/domain/uses-fs.ts`]:
    "import { readFileSync } from 'node:fs';\nexport const read = readFileSync;",
  [`${modules}/topology/domain/reaches-out.ts`]:
    "import { store } from '../infrastructure/store';\nexport const x = store;",
  [`${modules}/topology/application/reaches-http.ts`]:
    "import { routes } from '../http/routes';\nexport const x = routes;",
  [`${modules}/topology/http/reaches-domain.ts`]:
    "import { value } from '../domain/value';\nexport const x = value;",
  [`${modules}/topology/infrastructure/uses-kit.ts`]:
    "import { kit } from '../../../platform/http-kit';\nexport const x = kit;",
  [`${modules}/topology/http/uses-db.ts`]:
    "import { db } from '../../../platform/db';\nexport const x = db;",
  [`${modules}/sandbox/application/deep.ts`]:
    "import { value } from '../../topology/domain/value';\nexport const x = value;",
  [`${modules}/chaos/application/other-module.ts`]:
    "import { value } from '../../topology/index';\nexport const x = value;",
  'apps/server/src/platform/imports-module.ts':
    "import { value } from '../modules/topology/index';\nexport const x = value;",
  'apps/server/src/main.ts':
    "import { value } from './modules/topology/domain/value';\nexport const x = value;",
  'apps/web/src/reaches-server.ts':
    "import { app } from '../../server/src/app';\nexport const x = app;",
  'apps/worker/src/reaches-server.ts':
    "import { app } from '../../server/src/app';\nexport const x = app;",
  'apps/loadgen/src/reaches-shared-ok.ts':
    "import { shared } from '../../../packages/shared/src/index';\nexport const x = shared;",
  'apps/server/src/imports-worker.ts':
    "import { y } from '../../worker/src/y';\nexport const x = y;",
  'apps/worker/src/y.ts': 'export const y = 1;',
  'packages/contracts/src/imports-shared.ts':
    "import { shared } from '../../shared/src/index';\nexport const x = shared;",
  'packages/shared/src/imports-contracts.ts':
    "import { c } from '../../contracts/src/c';\nexport const x = c;",
  'packages/contracts/src/c.ts': 'export const c = 1;',
  'apps/loadgen/src/a.ts': "import { b } from './b';\nexport const a = b;",
  'apps/loadgen/src/b.ts': "import { a } from './a';\nexport const b = a;",
  'scripts/imports-app.ts': "import { app } from '../apps/server/src/app';\nexport const x = app;",
};

const expectedViolations: readonly (readonly [string, string])[] = [
  [`${modules}/topology/domain/uses-fs.ts`, 'pure-code-uses-no-node-builtins'],
  [`${modules}/topology/domain/reaches-out.ts`, 'domain-is-innermost'],
  [`${modules}/topology/application/reaches-http.ts`, 'application-does-not-import-edges'],
  [`${modules}/topology/http/reaches-domain.ts`, 'http-only-uses-application'],
  [`${modules}/topology/infrastructure/uses-kit.ts`, 'infrastructure-uses-only-db'],
  [`${modules}/topology/http/uses-db.ts`, 'http-uses-only-http-kit'],
  [`${modules}/sandbox/application/deep.ts`, 'module-sandbox-boundary'],
  [`${modules}/chaos/application/other-module.ts`, 'module-chaos-boundary'],
  ['apps/server/src/platform/imports-module.ts', 'platform-does-not-import-modules'],
  ['apps/server/src/main.ts', 'no-deep-module-imports'],
  ['apps/web/src/reaches-server.ts', 'web-sees-only-contracts'],
  ['apps/worker/src/reaches-server.ts', 'worker-isolation'],
  ['apps/server/src/imports-worker.ts', 'server-does-not-import-other-apps'],
  ['packages/contracts/src/imports-shared.ts', 'contracts-import-nothing-internal'],
  ['packages/shared/src/imports-contracts.ts', 'shared-imports-nothing-internal'],
  ['scripts/imports-app.ts', 'scripts-do-not-import-apps'],
  ['apps/loadgen/src/a.ts', 'no-circular'],
];

interface Violation {
  readonly from: string;
  readonly rule: string;
}

describe('module boundary rules', () => {
  let violations: Violation[] = [];
  let directory = '';

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'chaosboard-boundaries-'));
    for (const [path, content] of Object.entries(files)) {
      const absolute = join(directory, path);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, `${content}\n`);
    }
    const config = (await extractDepcruiseConfig(join(repoRoot, '.dependency-cruiser.cjs'))) as {
      forbidden?: IConfiguration['forbidden'];
      options: ICruiseOptions;
    };
    // The throwaway tree has no tsconfig, so the repository's tsConfig option is left out.
    const options = { ...config.options };
    delete options.tsConfig;
    const result = await cruise(['apps', 'packages', 'scripts'], {
      ...options,
      baseDir: directory,
      validate: true,
      ruleSet: { forbidden: config.forbidden ?? [] },
      tsPreCompilationDeps: false,
    });
    if (typeof result.output === 'string') {
      throw new Error('Expected structured cruise output.');
    }
    violations = result.output.summary.violations.map((violation) => ({
      from: violation.from,
      rule: violation.rule.name,
    }));
  });

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it.each(expectedViolations)('%s is rejected by %s', (from, rule) => {
    expect(violations).toContainEqual({ from, rule });
  });

  it('allows a module to use the public API of a module it may depend on', () => {
    expect(
      violations.filter((violation) => violation.from.endsWith('sandbox/application/allowed.ts')),
    ).toEqual([]);
  });

  it('allows an app that may use shared to import it', () => {
    expect(
      violations.filter((violation) => violation.from.endsWith('loadgen/src/reaches-shared-ok.ts')),
    ).toEqual([]);
  });
});
