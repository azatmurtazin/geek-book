// Escaping for the HTML renderers.
//
// `escapeHtml` is the engine's own: the characters HTML treats specially in
// text and attribute values. `escapeMarked` reproduces exactly what `marked`
// wrote, byte for byte, because the website is frozen against its output: it
// escapes the same five characters *and* leaves `&` alone when it opens an
// entity (the no-encode case), while code and code spans force every `&` to
// `&amp;` (the encode case). Keep the two apart: swapping them moves bytes.
//
// Pure: no imports.

/** Escape the characters HTML treats specially, in text and attribute values. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A book title with its first word emphasized, escaped: `**Programming** Essentials`. */
export function brandHtml(title: string): string {
  const [lead, ...rest] = title.trim().split(/\s+/);
  const tail = rest.length ? ` ${escapeHtml(rest.join(" "))}` : "";
  return `<em>${escapeHtml(lead ?? "")}</em>${tail}`;
}

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// `marked`'s own rules: `escapeTest`/`escapeTestNoEncode` in marked's lexer.
const ENCODE_TEST = /[&<>"']/;
const ENCODE_REPLACE = /[&<>"']/g;
const NO_ENCODE_TEST = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/;
const NO_ENCODE_REPLACE = /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g;

/**
 * Escape a run of text the way `marked` did: `<>"'` always, and `&` only when
 * it does not open an entity — unless `encode`, which escapes every `&`.
 *
 * The model decodes entities on the way in, so a decoded `&` is escaped here;
 * an entity the source wrote stays as the source wrote it only for code, which
 * is never decoded.
 */
export function escapeMarked(text: string, encode = false): string {
  const test = encode ? ENCODE_TEST : NO_ENCODE_TEST;
  if (!test.test(text)) return text;
  const replace = encode ? ENCODE_REPLACE : NO_ENCODE_REPLACE;
  return text.replace(replace, (char) => ENTITIES[char]);
}
