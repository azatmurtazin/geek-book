// The HTML entities the walk decodes, so the tree holds the characters the
// source meant and the LaTeX serializer escapes them afresh of its own accord.

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": "\u00a0",
};

/** Decode the named and numeric entities a source may spell. */
export function decodeEntities(str: string): string {
  return str.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m);
}
