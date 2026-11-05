/**
 * Module boundary rules. The rules are generated from tools/architecture/module-matrix.json and
 * the layer rules in section 5 of docs/plan.md. A failing rule is a design problem to fix, not a
 * rule to weaken. tools/architecture/boundaries.test.ts proves these rules actually fire.
 */
const matrix = require('./tools/architecture/module-matrix.json');

const MODULES = '^apps/server/src/modules';
const SERVER = '^apps/server/src';
const publicApi = (name) => `${MODULES}/${name}/index\\.ts$`;

const moduleRules = Object.entries(matrix.modules).map(([name, allowed]) => ({
  name: `module-${name}-boundary`,
  severity: 'error',
  comment: `Module "${name}" may import only its own files and the public API of: ${
    allowed.length === 0 ? 'no other module' : allowed.join(', ')
  }.`,
  from: { path: `${MODULES}/${name}/` },
  to: {
    path: `${MODULES}/`,
    pathNot: [`${MODULES}/${name}/`, ...allowed.map(publicApi)],
  },
}));

const forbidden = [
  ...moduleRules,
  {
    name: 'no-deep-module-imports',
    severity: 'error',
    comment: 'Other code may import a module only through its index.ts.',
    from: { path: `${SERVER}/(main\\.ts|app\\.ts|cli/)` },
    to: { path: `${MODULES}/[^/]+/`, pathNot: `${MODULES}/[^/]+/index\\.ts$` },
  },
  {
    name: 'platform-does-not-import-modules',
    severity: 'error',
    comment:
      'Platform is infrastructure for modules. Only main.ts, app.ts, and cli/ compose modules.',
    from: { path: `${SERVER}/platform/` },
    to: { path: `${MODULES}/` },
  },
  {
    name: 'domain-is-innermost',
    severity: 'error',
    comment: 'domain imports no application, infrastructure, or http code.',
    from: { path: `${MODULES}/[^/]+/domain/` },
    to: { path: `${MODULES}/[^/]+/(application|infrastructure|http)/` },
  },
  {
    name: 'application-does-not-import-edges',
    severity: 'error',
    comment: 'application imports no infrastructure or http code. It defines ports instead.',
    from: { path: `${MODULES}/[^/]+/application/` },
    to: { path: `${MODULES}/[^/]+/(infrastructure|http)/` },
  },
  {
    name: 'infrastructure-does-not-import-http',
    severity: 'error',
    from: { path: `${MODULES}/[^/]+/infrastructure/` },
    to: { path: `${MODULES}/[^/]+/http/` },
  },
  {
    name: 'http-only-uses-application',
    severity: 'error',
    comment: 'Controllers call use cases. They never reach into domain rules or infrastructure.',
    from: { path: `${MODULES}/[^/]+/http/` },
    to: { path: `${MODULES}/[^/]+/(domain|infrastructure)/` },
  },
  {
    name: 'inner-layers-do-not-use-platform',
    severity: 'error',
    comment: 'domain and application receive everything as arguments and never import platform.',
    from: { path: `${MODULES}/[^/]+/(domain|application)/` },
    to: { path: `${SERVER}/platform/` },
  },
  {
    name: 'http-uses-only-http-kit',
    severity: 'error',
    from: { path: `${MODULES}/[^/]+/http/` },
    to: { path: `${SERVER}/platform/`, pathNot: `${SERVER}/platform/http-kit\\.ts$` },
  },
  {
    name: 'infrastructure-uses-only-db',
    severity: 'error',
    from: { path: `${MODULES}/[^/]+/infrastructure/` },
    to: { path: `${SERVER}/platform/`, pathNot: `${SERVER}/platform/db\\.ts$` },
  },
  {
    name: 'pure-code-uses-no-node-builtins',
    severity: 'error',
    comment: 'domain folders, contracts, and shared are pure.',
    from: {
      path: [`${MODULES}/[^/]+/domain/`, '^packages/(contracts|shared)/src/'],
      pathNot: ['\\.test\\.ts$', '/tests/'],
    },
    to: { dependencyTypes: ['core'] },
  },
  {
    name: 'contracts-import-nothing-internal',
    severity: 'error',
    from: { path: '^packages/contracts/' },
    to: { path: '^(apps/|packages/(?!contracts/))' },
  },
  {
    name: 'shared-imports-nothing-internal',
    severity: 'error',
    from: { path: '^packages/shared/' },
    to: { path: '^(apps/|packages/(?!shared/))' },
  },
  {
    name: 'worker-isolation',
    severity: 'error',
    comment: 'The worker is a data plane program. It sees only contracts and shared.',
    from: { path: '^apps/worker/' },
    to: { path: '^(apps/(?!worker/)|packages/(?!(contracts|shared)/))' },
  },
  {
    name: 'loadgen-isolation',
    severity: 'error',
    from: { path: '^apps/loadgen/' },
    to: { path: '^(apps/(?!loadgen/)|packages/(?!(contracts|shared)/))' },
  },
  {
    name: 'web-sees-only-contracts',
    severity: 'error',
    from: { path: '^apps/web/' },
    comment:
      'The browser may depend on the shared contracts and on the DOM-free WebRTC mesh package, whose\n' +
      'logic is verified against a real WebRTC stack in the server test suite.',
    to: { path: '^(apps/(?!web/)|packages/(?!(contracts|webrtc-mesh)/))' },
  },
  {
    name: 'server-does-not-import-other-apps',
    severity: 'error',
    comment: 'The server spawns worker and loadgen as processes. It never imports their code.',
    from: { path: '^apps/server/' },
    to: { path: '^apps/(?!server/)' },
  },
  {
    name: 'scripts-do-not-import-apps',
    severity: 'error',
    from: { path: '^scripts/' },
    to: { path: '^apps/' },
  },
  {
    name: 'no-circular',
    severity: 'error',
    from: {},
    to: { circular: true },
  },
  {
    name: 'not-to-unresolvable',
    severity: 'error',
    from: {},
    to: { couldNotResolve: true },
  },
  {
    name: 'production-code-not-to-dev-dependencies',
    severity: 'error',
    from: {
      path: '^(apps|packages)/[^/]+/src/',
      pathNot: ['\\.test\\.tsx?$', '/tests/', 'vite\\.config\\.ts$', 'vitest.*\\.config\\.ts$'],
    },
    to: { dependencyTypes: ['npm-dev'] },
  },
  {
    name: 'production-code-not-to-tests',
    severity: 'error',
    from: { pathNot: ['\\.test\\.tsx?$', '/tests/'] },
    to: { path: ['\\.test\\.tsx?$', '/tests/'] },
  },
];

module.exports = {
  forbidden,
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    moduleSystems: ['es6', 'cjs'],
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types'],
    },
    exclude: { path: ['/dist/', '/coverage/', '/data/'] },
  },
};
