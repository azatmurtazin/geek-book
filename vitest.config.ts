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
      // Floors, not targets: the suite sits at ~69% lines today. They keep the
      // number from drifting down unnoticed; raise them as the gaps close.
      thresholds: { statements: 65, branches: 55, functions: 70, lines: 65 },
    },
  },
});
