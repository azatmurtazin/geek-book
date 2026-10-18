// A chapter's ```mermaid``` fences, taken out of its Markdown.
//
// Pure string work: each fence becomes a placeholder paragraph keyed by index,
// and the fence's source stays available so the build can draw it. Markdown
// therefore never has to digest the SVG, and the drawing is injected after
// `marked` has parsed the (placeholder) document (see `substituteDiagrams`).
//
// Shared by both builders: the printed edition draws each fence into a PDF
// figure, the website into inline SVG, and both read the faces this returns.
//
// Pure: no imports outside `domain/`.

/** The faces of a chapter that carries mermaid fences. */
export interface ExtractedDiagrams {
  /** The source with each fence replaced by its placeholder paragraph. */
  readonly markdown: string;
  /** The fence sources, keyed by the placeholder index (`1`, `2`, …). */
  readonly diagrams: Map<number, string>;
}

/**
 * Swap every fenced ```mermaid``` block for a placeholder paragraph keyed by
 * its position. An unterminated fence is left as written, for the linter to
 * call out.
 */
export function extractDiagrams(source: string): ExtractedDiagrams {
  const lines = source.split("\n");
  const out: string[] = [];
  const diagrams = new Map<number, string>();
  let index = 0;
  let i = 0;
  while (i < lines.length) {
    if (!/^```mermaid\s*$/.test(lines[i])) {
      out.push(lines[i]);
      i += 1;
      continue;
    }
    const body: string[] = [];
    i += 1;
    while (i < lines.length && !/^```\s*$/.test(lines[i])) {
      body.push(lines[i]);
      i += 1;
    }
    if (i >= lines.length) {
      // Unterminated fence: leave it for the linter to call out.
      out.push("```mermaid", ...body);
      break;
    }
    i += 1;
    index += 1;
    diagrams.set(index, body.join("\n"));
    out.push("", `::gb-diagram-${index}::`, "");
  }
  return { markdown: out.join("\n"), diagrams };
}
