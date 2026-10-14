// Book-content CSS shared by every render target that emits the same markup:
// the web book (`build-web-book/site.css.ts`) and the standalone page layout
// (`_layouts/default.html`). These rules were copy-pasted into both stylesheets,
// so a change to the code label or the comment colour had to be made twice and
// could drift.
//
// Each function takes a `scope` selector prefix — pass ".book-body" to confine
// the rules to the web book's reading column, or "" where the page has a single
// content area (the standalone layout).

/** The `--code-comment` custom property, one source of truth for both themes. */
export const CODE_COMMENT_VAR = "--code-comment: #6b7280;";

function scoped(scope: string): (selector: string) => string {
  return (selector) => (scope ? `${scope} ${selector}` : selector);
}

/** Code presentation: the fenced block, its language label, comments and the
 *  inline `code` spans. */
export function codeCss(scope = ""): string {
  const sel = scoped(scope);
  return [
    `${sel("pre code")} { background: none; padding: 0; border: 0; font-size: inherit; color: inherit; }`,
    `${sel("pre code .code-comment")} { color: var(--code-comment); }`,
    `${sel(".code-block")} { position: relative; }`,
    `${sel(".code-label")} {`,
    "  position: absolute; top: 0.5rem; right: 0.7rem;",
    "  font-family: var(--font-mono); font-size: 0.62rem;",
    "  letter-spacing: 0.05em; color: var(--code-comment);",
    "}",
    `${sel(":not(pre) > code")} { font-family: var(--font-mono); font-size: 0.84em; color: var(--code-fg); }`,
  ].join("\n");
}

/** Mermaid diagrams, rendered to inline SVG and centred in the text column. */
export function diagramCss(scope = ""): string {
  const sel = scoped(scope);
  return [
    `${sel(".diagram")} { margin: 1.3rem auto; text-align: center; }`,
    `${sel(".diagram svg")} { max-width: 100%; height: auto; }`,
  ].join("\n");
}
