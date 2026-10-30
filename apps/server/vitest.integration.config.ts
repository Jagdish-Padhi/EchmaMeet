import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts', 'tests/**/*.integration.test.ts'],
    passWithNoTests: true,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
