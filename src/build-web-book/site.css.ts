// Stylesheet for the web book, meant to echo the HonKit (GitBook) default:
// a fixed sidebar with the SUMMARY tree, a slim header, a centred reading
// column, and previous/next navigation under the page body.
//
// The code-block and diagram rules are shared with the standalone page layout
// (_layouts/default.html) via src/lib/content-css.ts, so they are edited once.

import { CODE_COMMENT_VAR, codeCss, diagramCss } from "../lib/content-css.js";
import { CODE_STACK, TEXT_STACK } from "../lib/fonts.js";

export const SITE_CSS = `
:root {
  --fg: #242a37;
  --muted: #6b7280;
  --accent: #4183c4;
  --accent-soft: #eef4fb;
  --rule: #e5e8ed;
  --sidebar-bg: #f9fafb;
  --code-bg: #f6f7f9;
  --code-fg: #20304c;
  ${CODE_COMMENT_VAR}
  --callout-bg: #f8fafc;
  --callout-border: #cbd5e1;
  --font-sans: ${TEXT_STACK};
  --font-mono: ${CODE_STACK};
}

* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; font-family: var(--font-sans); font-size: 16px; line-height: 1.65; color: var(--fg); }

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; text-underline-offset: 2px; }
.book-body a { color: var(--fg); text-decoration: underline; text-underline-offset: 2px; }

/* --- sidebar -------------------------------------------------------------- */

#sidebar-toggle { display: none; }

.sidebar {
  position: fixed; top: 0; left: 0; bottom: 0; width: 300px;
  background: var(--sidebar-bg); border-right: 1px solid var(--rule);
  overflow-y: auto; padding: 1rem 0 2rem; z-index: 10;
}
.sidebar-brand { padding: 0.6rem 1.25rem 0.9rem; border-bottom: 1px solid var(--rule); }
.sidebar-brand a { font-weight: 700; color: var(--fg); letter-spacing: -0.01em; }
.sidebar-brand em { font-style: normal; color: var(--accent); }
.sidebar ul { list-style: none; margin: 0; padding: 0; }
.sidebar li { margin: 0; }
.sidebar-part {
  padding: 1.1rem 1.25rem 0.35rem;
  font-size: 0.74rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--muted);
}
.sidebar li a {
  display: block; padding: 0.28rem 1.25rem; color: #3b4b52; border-right: 3px solid transparent;
}
.sidebar li a:hover { background: var(--accent-soft); text-decoration: none; }
.sidebar li a.active { color: var(--accent); background: var(--accent-soft); border-right-color: var(--accent); font-weight: 600; }
.sidebar .depth-1 a { padding-left: 2.2rem; font-size: 0.95em; }
.sidebar .depth-2 a { padding-left: 3.1rem; font-size: 0.9em; }

/* --- page ----------------------------------------------------------------- */

.page-wrapper { margin-left: 300px; min-height: 100vh; display: flex; flex-direction: column; }

.book-header {
  position: sticky; top: 0; z-index: 5;
  display: flex; align-items: center; gap: 1rem;
  padding: 0.7rem 1.75rem; background: #fff;
  border-bottom: 1px solid var(--rule);
}
.book-header .menu-toggle { display: none; cursor: pointer; border: 1px solid var(--rule); border-radius: 6px; padding: 0.15rem 0.5rem; background: #fff; font-size: 1.1rem; line-height: 1.4; }
.book-header .header-title { font-size: 0.85rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.book-header .header-nav { margin-left: auto; font-size: 0.85rem; white-space: nowrap; }
.book-header .header-nav a + a { margin-left: 0.9rem; }

.book-body { flex: 1; max-width: 46rem; padding: 2.25rem 1.75rem 3rem; width: 100%; }

.book-body h1 { font-size: 1.9rem; line-height: 1.25; letter-spacing: -0.02em; margin: 0 0 1.2rem; padding-bottom: 0.6rem; border-bottom: 2px solid var(--rule); }
.book-body h2 { font-size: 1.35rem; letter-spacing: -0.01em; margin: 2rem 0 0.6rem; }
.book-body h3 { font-size: 1.12rem; margin: 1.5rem 0 0.45rem; }
.book-body h4 { font-size: 1rem; margin: 1.25rem 0 0.4rem; }
.book-body h5, .book-body h6 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.book-body p { margin: 0.85rem 0; }
.book-body ul, .book-body ol { margin: 0.85rem 0; padding-left: 1.5rem; }
.book-body li { margin: 0.3rem 0; }
.book-body hr { border: 0; border-top: 1px solid var(--rule); margin: 2.2rem 0; }

.book-body blockquote {
  margin: 1.1rem 0; padding: 0.7rem 1rem 0.7rem 1.1rem;
  border-left: 4px solid var(--callout-border); background: var(--callout-bg);
  border-radius: 0 8px 8px 0; color: #3b4252;
}
.book-body blockquote p:first-child { margin-top: 0; }
.book-body blockquote p:last-child { margin-bottom: 0; }

.book-body pre {
  margin: 1.1rem 0; padding: 0.9rem 1.1rem; background: var(--code-bg);
  border: 1px solid var(--rule); border-radius: 8px; overflow-x: auto;
  font-family: var(--font-mono); font-size: 0.79rem; line-height: 1.55; color: var(--code-fg);
}
${codeCss(".book-body")}

.book-body table { width: 100%; border-collapse: collapse; margin: 1.1rem 0; font-size: 0.9rem; }
.book-body th { text-align: left; font-size: 0.72rem; letter-spacing: 0.05em; color: var(--muted); border-bottom: 2px solid var(--rule); padding: 0.45rem 0.65rem; }
.book-body td { border-bottom: 1px solid var(--rule); padding: 0.5rem 0.65rem; vertical-align: top; }
.book-body tbody tr:nth-child(even) { background: #fafbfc; }
.book-body img { max-width: 100%; border-radius: 8px; }

${diagramCss(".book-body")}

/* --- prev / next navigation ------------------------------------------------ */

.chapter-nav { display: flex; justify-content: space-between; gap: 1rem; margin-top: 2.5rem; padding-top: 1.25rem; border-top: 1px solid var(--rule); font-size: 0.9rem; }
.chapter-nav div.prev { text-align: left; }
.chapter-nav div.next { text-align: right; margin-left: auto; }
.chapter-nav .nav-label { display: block; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 0.15rem; }
.chapter-nav a { font-weight: 600; }

.book-footer { padding: 1.25rem 1.75rem 2rem; font-size: 0.8rem; color: var(--muted); border-top: 1px solid var(--rule); }

/* --- mobile ---------------------------------------------------------------- */

@media (max-width: 800px) {
  .sidebar { transform: translateX(-100%); transition: transform 0.2s ease; width: 280px; }
  .page-wrapper { margin-left: 0; }
  .book-header .menu-toggle { display: inline-block; }
  #sidebar-toggle:checked ~ .sidebar { transform: translateX(0); }
  #sidebar-toggle:checked ~ .page-wrapper { margin-left: 0; }
  .book-body { padding: 1.5rem 1.1rem 2.5rem; }
}
`.trim();
