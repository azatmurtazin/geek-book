// .dependency-cruiser.cjs — the architectural boundaries, as rules.
//
// These mirror docs/CLEAN_CODE_ARCHITECTURE.md §13 and the invariants of
// docs/ARCHITECTURE_REFACTORING_PLAN.md §3. They are **enforced** (severity:
// "error"): the refactor has landed, `just boundaries` is part of `just lint`,
// and every violation fails the build.
//
// Run with `just boundaries`. `test/architecture.test.ts` asserts the same rules
// programmatically, so a violation also fails `just test`.
//
// Every rule below is a `forbidden` rule: a dependency matching `from` and `to`
// is a violation. Comments say what each one protects.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-is-pure",
      severity: "error",
      comment:
        "domain/ is the pure core: it imports nothing outside domain/ — no node:, " +
        "no third-party, no outer layer.",
      from: { path: "^src/domain" },
      to: { pathNot: "^src/domain" },
    },
    {
      name: "application-depends-on-domain-only",
      severity: "error",
      comment:
        "application/ holds use cases and ports; it may import application/ and " +
        "domain/ only, never an adapter or the CLI.",
      from: { path: "^src/application" },
      to: { path: "^src/(adapters|cli)" },
    },
    {
      name: "adapters-avoid-cli",
      severity: "error",
      comment: "adapters/ implement ports and never reach up into the composition root.",
      from: { path: "^src/adapters" },
      to: { path: "^src/cli" },
    },
    {
      name: "marked-only-in-its-adapter",
      severity: "error",
      comment:
        "The Markdown parser is an adapter detail: only src/adapters/markdown may " +
        "import marked.",
      from: { pathNot: "^src/adapters/markdown" },
      to: { path: "^node_modules/marked" },
    },
    {
      name: "jsdom-only-in-its-adapter",
      severity: "error",
      comment:
        "jsdom exists only to give Mermaid a browser to draw in: only " +
        "src/adapters/diagrams may import it.",
      from: { pathNot: "^src/adapters/diagrams" },
      to: { path: "^node_modules/jsdom" },
    },
    {
      name: "mermaid-only-in-its-adapter",
      severity: "error",
      comment:
        "Mermaid is a drawing library: only src/adapters/diagrams may import it, " +
        "and the rest of the engine sees a Figure.",
      from: { pathNot: "^src/adapters/diagrams" },
      to: { path: "^node_modules/mermaid" },
    },
    {
      name: "no-node-builtins-in-domain-or-application",
      severity: "error",
      comment:
        "The pure layers never import a node: builtin; I/O reaches them through " +
        "ports implemented in adapters/.",
      from: { path: "^src/(domain|application)" },
      to: { dependencyTypes: ["core"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    // The repo tracks TypeScript 7, which dependency-cruiser's built-in `typescript`
    // transpiler does not support yet (>=2 <7); SWC parses the syntax instead.
    parser: "swc",
  },
};
