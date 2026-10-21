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
      // Floors, not targets: the suite sits at ~81% lines today (the CLI commands
      // are spawned, so they read as unimported). A margin below the current
      // numbers keeps the report honest without making it brittle.
      thresholds: { statements: 79, branches: 69, functions: 87, lines: 79 },
    },
  },
});
