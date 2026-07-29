import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// The suite covers src/lib only — the deterministic scoring/analysis core that
// the product's claims rest on. Those modules are pure functions with no DOM
// dependency, so the default node environment is enough; no jsdom needed.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      include: ['src/lib/**/*.ts'],
      // Reported, not enforced — a failing threshold on day one would just get
      // switched off. Raise this deliberately as coverage grows.
      reporter: ['text', 'lcov'],
    },
  },
});
