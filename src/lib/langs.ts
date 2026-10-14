// Everything the tooling needs to know about the languages in the book, so the
// linter's allowed set, the comment highlighter and the code-block labels all
// agree from one place.

/**
 * The fence languages the linter accepts when `book.config.json` does not name
 * its own list — prose, shells, the data formats, and the platform languages a
 * domain chapter may reach for. Generous on purpose: it is an allow-list, and a
 * book that wants a shorter one sets `languages` in its config.
 */
export const DEFAULT_LANGS: string[] = [
  "text", "plaintext", "ascii", "mermaid",
  "bash", "sh", "shell", "console",
  "java", "cpp", "c++", "c", "go", "rust", "typescript", "ts", "javascript",
  "js", "jsx", "tsx", "php", "python", "elixir", "sql", "json", "yaml", "toml", "xml",
  "html", "css", "diff", "make", "makefile", "ini", "hcl", "protobuf",
  // Platform languages — used only in the domain chapters (system programming,
  // frontend, desktop, mobile) where they are the idiom, never book-wide.
  "kotlin", "swift", "csharp", "cs", "dart",
];

/** Languages whose comments start with `//` and with the block-comment opener. */
export const SLASH_COMMENT_LANGS = new Set([
  "c", "cpp", "csharp", "cs", "dart", "go", "java", "javascript", "jsx", "kotlin", "php",
  "rust", "swift", "ts", "tsx", "typescript",
]);

/** Languages whose comments start with `#`. */
export const HASH_COMMENT_LANGS = new Set([
  "bash", "elixir", "makefile", "php", "py", "python", "rb", "ruby", "sh", "shell",
  "toml", "yaml", "yml",
]);

/** Human-friendly label for a code fence, shown top-right of the block. */
export const CODE_LABELS: Record<string, string> = {
  bash: "Bash",
  c: "C",
  cpp: "C++",
  cs: "C#",
  csharp: "C#",
  dart: "Dart",
  elixir: "Elixir",
  go: "Go",
  java: "Java",
  javascript: "JavaScript",
  js: "JavaScript",
  jsx: "JSX",
  json: "JSON",
  kotlin: "Kotlin",
  php: "PHP",
  py: "Python",
  python: "Python",
  rust: "Rust",
  sh: "Shell",
  shell: "Shell",
  swift: "Swift",
  ts: "TypeScript",
  tsx: "TSX",
  typescript: "TypeScript",
};
