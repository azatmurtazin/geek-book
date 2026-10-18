// The build-time `{{ … }}` substitution rule, over a placeholder map.
//
// The caller supplies the map — a book's own tokens plus the built-in metadata —
// so this stays pure and knows nothing about where the values came from. Fenced
// code blocks are left byte-for-byte, so a `{{ … }}` inside a sample (Go
// templates, JSX, C++ braces) is never rewritten, and only keys the map names
// are replaced — anything else, such as Go's `{{.}}`, passes through.
//
// Pure: no imports outside `domain/`.

/** The tokens a substitution may use, keyed by token name. */
export type PlaceholderMap = Readonly<Record<string, string>>;

const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9-]*)\s*\}\}/g;
const FENCE = /^\s{0,3}(?:```|~~~)/;

/** Fill `{{ token }}` placeholders in `source`, skipping fenced code. */
export function substitute(placeholders: PlaceholderMap, source: string): string {
  let inFence = false;
  return source
    .split("\n")
    .map((line) => {
      if (FENCE.test(line)) {
        inFence = !inFence;
        return line;
      }
      return inFence ? line : line.replace(PLACEHOLDER, (whole, key: string) => placeholders[key] ?? whole);
    })
    .join("\n");
}
