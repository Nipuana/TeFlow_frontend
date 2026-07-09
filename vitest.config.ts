import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Test runner config for the frontend.
 *   - jsdom environment so components can render into a DOM.
 *   - the `@/*` path alias mirrors tsconfig so tests import like app code does.
 *   - TZ pinned to UTC so date-helper tests are deterministic across machines.
 * Tests live in a dedicated top-level `tests/` folder, separate from `app/`.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    env: { TZ: 'UTC' },
  },
});
