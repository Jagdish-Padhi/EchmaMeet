import { builtinModules } from 'node:module';
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const nodeBuiltinPatterns = ['node:*', ...builtinModules.filter((name) => !name.startsWith('_'))];

/**
 * Pure code (domain folders, contracts, shared, and later the worker policy folder) may not touch
 * time, randomness, the process, the console, timers, or Node built-ins. Anything impure is
 * injected. See docs/plan.md section 5.6.
 */
const purityRules = {
  'no-restricted-globals': [
    'error',
    ...[
      'process',
      'console',
      'setTimeout',
      'setInterval',
      'setImmediate',
      'performance',
      'fetch',
    ].map((name) => ({ name, message: 'Pure code must receive this capability as an argument.' })),
  ],
  'no-restricted-properties': [
    'error',
    { object: 'Date', property: 'now', message: 'Inject a Clock instead of reading time.' },
    { object: 'Math', property: 'random', message: 'Inject a RandomSource instead.' },
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: "NewExpression[callee.name='Date'][arguments.length=0]",
      message: 'Inject a Clock instead of reading time.',
    },
  ],
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        { group: nodeBuiltinPatterns, message: 'Pure code cannot import Node built-ins.' },
      ],
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.smoke-output/**',
      '**/.venv/**',
      'ml/**',
      'data/**',
      'docs/**',
      'neon.ts',
      'pnpm-lock.yaml',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: false }],
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: { ...globals.node },
    },
  },
  {
    // CommonJS config files (dependency-cruiser reads its configuration with require).
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: [
      'apps/server/src/modules/*/domain/**/*.ts',
      'apps/worker/src/policy/**/*.ts',
      'packages/contracts/src/**/*.ts',
      'packages/shared/src/**/*.ts',
    ],
    ignores: ['**/*.test.ts'],
    rules: purityRules,
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    files: ['scripts/**/*.ts', 'tools/**/*.ts', 'apps/server/src/cli/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.test.ts', '**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
);
