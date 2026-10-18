// Small, pure string helpers the two editions and the linter share.

/**
 * Split on newlines the way Python's `splitlines()` did: CRLF counts as one
 * break, and a trailing newline does not add an empty final line.
 */
export function splitLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines.length && text.endsWith("\n") && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}
