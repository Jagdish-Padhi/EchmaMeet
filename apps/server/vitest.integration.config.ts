import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts', 'tests/**/*.integration.test.ts'],
    passWithNoTests: true,
    fileParallelism: false,
    maxConcurrency: 1,
    testTimeout: 90_000,
    hookTimeout: 90_000,
  },
});
