// The TemplateStore port: the plain assets the renderers wrap pages in.
//
// The layout, the two stylesheets and the LaTeX preamble ship with the engine;
// a book may add its own `web.css` and `web.head`. Reading them — and knowing
// where the engine's own files sit — is an adapter's business (see
// `adapters/templates/asset-template-store.ts`). The port answers text, never a
// path, so nothing downstream needs to know where a template lives.

export interface TemplateStore {
  /** `_layouts/default.html`: the standalone page shell. */
  layout(): string;
  /** The built-in stylesheet the website and a standalone page share. */
  contentCss(): string;
  /** The website-only stylesheet. */
  siteCss(): string;
  /** The LaTeX preamble the printed edition starts from. */
  texPreamble(): string;
  /** The book's own `web.css`, or "" when it names none. */
  bookCss(path: string): string;
  /** The book's own `web.head` HTML, or "" when it names none. */
  headHtml(path: string): string;
}
