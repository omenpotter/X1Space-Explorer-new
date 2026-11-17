import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Kept separate from vite.config.js so the Base44 build plugin is not loaded for tests.
const live = process.env.LIVE === '1';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // Platform-only module: tests use a stub (see tests/backend/stubs/actors.ts).
      'base44:runtime/actors': path.resolve(import.meta.dirname, 'tests/backend/stubs/actors.ts'),
    },
  },
  test: {
    include: live
      ? ['tests/live/**/*.test.{js,ts}']
      : ['tests/backend/**/*.test.{js,ts}', 'tests/frontend/**/*.test.{js,jsx}'],
    environment: 'node',
    testTimeout: live ? 120000 : 10000,
  },
});
