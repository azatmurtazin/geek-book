import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      // Only TypeScript is instrumented: `src/**` also matches site.css,
      // content.css, the layout and preamble.tex, and the V8 provider throws
      // a PARSE_ERROR trying to read those as JavaScript.
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      // Floors, not targets: the suite sits at ~85% lines today (the CLI commands
      // are spawned, so they read as unimported). A margin below the current
      // numbers keeps the report honest without making it brittle.
      thresholds: { statements: 82, branches: 72, functions: 90, lines: 82 },
    },
  },
});
