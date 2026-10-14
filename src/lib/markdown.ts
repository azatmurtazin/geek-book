// Generic markdown helpers shared by the renderers and the linter. They live in
// a neutral module so neither side depends on the other.

/** Split on newlines the way Python's `splitlines()` did (no trailing empty). */
export function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.length && text.endsWith("\n") && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

/** Approximate the header identifier algorithm the renderers emit, close enough to check. */
export function slugify(text: string): string {
  const withoutMarkup = text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1");
  const stripped = withoutMarkup.toLowerCase().replace(/[^\p{L}\p{N}_\- ]+/gu, "");
  return stripped.replace(/ /g, "-");
}
