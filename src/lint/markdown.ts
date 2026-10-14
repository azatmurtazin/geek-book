// Markdown parsing helpers shared across the checks.
//
// The regexes carry named groups, but strict TypeScript sees `RegExpMatchArray`
// groups as string | undefined; the small `match*` wrappers below narrow them
// so the checks read cleanly.

export const MAX_LINE = 100;
// Cross-language comparison tables are the point of the book and cannot fit in
// 100 columns, so they get their own, looser budget.
export const MAX_TABLE_LINE = 240;
export const MAX_DIAGRAM_COLS = 80;

const FENCE_RE = /^(?<indent>\s*)(?<ticks>`{3,}|~{3,})(?<info>.*)$/;
const HEADING_RE = /^(?<hashes>#{1,6})\s+(?<text>.*?)\s*#*$/;
// An inline code span. Prose that documents a link (`` `[x](a.md)` ``) is not a
// link, and treating it as one makes the README untellable about its own build.
const CODE_SPAN_RE = /`+[^`]*`+/g;
// A fence may carry pandoc attributes after the language, either as a bare
// `{...}` block or as `{.lang attr="v"}`. Commands must not be read as the
// language name.
const ATTR_FENCE_RE = /^\{(?<attrs>[^}]*)\}\s*$/;

export interface FenceMatch {
  ticks: string;
  info: string;
}

export interface HeadingMatch {
  level: number;
  text: string;
}

/** A heading as collected by the structural checks: [level, text, line]. */
export type Heading = [level: number, text: string, line: number];

/** A markdown link as resolved by the link checks. */
export interface LinkMatch {
  target: string;
}

/** Expand tabs to `size`-column tab stops, like Python's `expandtabs`. */
export function expandTabs(s: string, size = 4): string {
  let out = "";
  let col = 0;
  for (const ch of s) {
    if (ch === "\t") {
      const spaces = size - (col % size);
      out += " ".repeat(spaces);
      col += spaces;
    } else {
      out += ch;
      col += 1;
    }
  }
  return out;
}

export function matchFence(line: string): FenceMatch | null {
  const m = FENCE_RE.exec(line);
  if (!m?.groups) {
    return null;
  }
  return { ticks: m.groups.ticks ?? "", info: m.groups.info ?? "" };
}

export function matchHeading(line: string): HeadingMatch | null {
  const m = HEADING_RE.exec(line);
  if (!m?.groups) {
    return null;
  }
  const hashes = m.groups.hashes ?? "";
  return { level: hashes.length, text: m.groups.text ?? "" };
}

/** Strip inline code spans so their contents are not read as links. */
export function stripCodeSpans(line: string): string {
  return line.replace(CODE_SPAN_RE, "");
}

/** Extract every `](target)` from a single, non-fenced line. */
export function linkTargets(line: string): LinkMatch[] {
  return Array.from(line.matchAll(LINK_RE), (m) => ({ target: m.groups?.target ?? "" }));
}

// LINK_RE is global and consumed through matchAll only.
const LINK_RE = /(?<!!)\[(?<text>[^\]]*)\]\((?<target>[^)]+)\)/g;

/** Return the language of a fence info string, ignoring pandoc attributes.
 *
 * "go"                  -> "go"
 * "{.go}"               -> "go"
 * '{.go filename="a.go"}' -> "go"
 * ""                    -> ""
 */
export function parseFenceLang(info: string): string {
  const trimmed = info.trim();
  if (!trimmed) {
    return "";
  }

  const block = ATTR_FENCE_RE.exec(trimmed);
  if (block?.groups) {
    const attrs = (block.groups.attrs ?? "").split(/\s+/).filter(Boolean);
    // A bare leading token (e.g. `{go .numberLines}`) names the language.
    if (attrs.length && !attrs[0].startsWith(".")) {
      return attrs[0];
    }
    // Otherwise the language is the single `.lang` class, if there is one.
    // More than one class means we cannot tell which one is the language,
    // so report none rather than guessing.
    const classes = attrs.filter((a) => a.startsWith(".")).map((a) => a.slice(1));
    return classes.length === 1 ? classes[0] : "";
  }

  return trimmed.split(/\s+/)[0];
}
