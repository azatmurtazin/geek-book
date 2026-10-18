// Built-in knowledge about the fence languages in the book: the linter's default
// allow-list, and the comment syntax and label each language starts with. A
// book's own languages extend these through the config's `code` map, which the
// functions here resolve against the built-in tables.
//
// Pure: no imports outside `domain/`.

/**
 * The fence languages the linter accepts when `book.config.json` does not name
 * its own list — prose, shells, the data formats, and the platform languages a
 * domain chapter may reach for. Generous on purpose: it is an allow-list, and a
 * book that wants a shorter one sets `languages` in its config.
 */
export const DEFAULT_LANGS: string[] = [
  "text", "plaintext", "ascii", "mermaid", "markdown", "md",
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
  markdown: "Markdown",
  md: "Markdown",
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

/** How comments are introduced in a code fence. */
export type CommentStyle = "slash" | "hash";

/** A book's own code-fence language: the chip a block shows and how its
 *  comments are marked, for a language the built-in table does not know. */
export interface CodeLanguage {
  /** The label the block shows; a language with none shows no chip. */
  readonly label: string;
  /** Its comment syntax, or "" to keep the built-in choice (usually none). */
  readonly comment: CommentStyle | "";
}

/** A book's `code` map, keyed by lower-case fence tag. */
export type CodeTable = Readonly<Record<string, CodeLanguage>>;

/** How comments are introduced in `lang`, or null when it has none. */
export function commentStyle(code: CodeTable, lang: string): CommentStyle | null {
  const key = lang.toLowerCase();
  const custom = code[key]?.comment;
  if (custom === "slash" || custom === "hash") return custom;
  if (SLASH_COMMENT_LANGS.has(key)) return "slash";
  if (HASH_COMMENT_LANGS.has(key)) return "hash";
  return null;
}

/** The chip a code block shows for `lang`, or undefined for none. */
export function codeLabel(code: CodeTable, lang: string): string | undefined {
  const key = lang.toLowerCase();
  return code[key]?.label || CODE_LABELS[key];
}
