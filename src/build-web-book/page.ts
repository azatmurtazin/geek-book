// Assembling a chapter page: the document template and its head script, the
// pieces that go into it (sidebar, footer, meta tags, prev/next links), and the
// site's shared assets — the head HTML and the stylesheet.

import fs from "node:fs";
import { escapeHtml } from "../lib/html.js";
import type { BookConfig } from "../lib/book-config.js";
import { fontCssVars, fontLinks } from "../lib/fonts.js";
import { readCss } from "../lib/css.js";
import { webPaletteVars } from "../lib/web-palette.js";
import { metaTags, pageUrl } from "../lib/site-meta.js";
import { ui } from "../lib/ui-strings.js";
import { footerHtml, sidebarHtml } from "./nav.js";
import { assetHref, pageHref } from "./paths.js";

export interface MappedChapter {
  /** Path relative to book/, e.g. "chapters/01_data_types/numbers.md". */
  relBook: string;
  label: string;
  indent: number;
}

export interface NavSlot {
  label: string;
  outputRel: string;
}

/** The storage keys the reader's two choices are remembered under. */
const THEME_KEY = "geek-book-theme";
const NAV_KEY = "geek-book-nav";

// The one script the site carries, in the page head so it runs before the first
// paint: it puts the reader's theme and their folded-panel choice on <html>,
// then wires the two header controls that flip them. Everything else on the
// page — including the foldable sidebar — works without it, so a reader with
// scripts off gets the light theme, a `<details>` tree that still folds, and a
// nav checkbox that still folds the whole panel for the page they are on.
// Storage is guarded because a browser in private mode (or with cookies off)
// throws on access — then the choice is simply not kept.
const SITE_SCRIPT = `(() => {
  const THEME = "${THEME_KEY}";
  const NAV = "${NAV_KEY}";
  const root = document.documentElement;
  const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* not kept */ } };
  const wide = matchMedia("(min-width: 801px)");

  root.dataset.theme = read(THEME) ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  if (wide.matches && read(NAV) === "folded") root.dataset.nav = "folded";

  addEventListener("DOMContentLoaded", () => {
    const theme = document.querySelector(".theme-toggle");
    if (theme) {
      const pressed = () => theme.setAttribute("aria-pressed", String(root.dataset.theme === "dark"));
      pressed();
      theme.addEventListener("click", () => {
        root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
        write(THEME, root.dataset.theme);
        pressed();
      });
    }

    // The nav checkbox means two things: on a phone the docked panel is a
    // slide-over and checked puts it in view, which is not worth remembering;
    // on a desktop checked folds the docked panel away, and that we keep.
    const box = document.querySelector("#sidebar-toggle");
    if (!box) return;
    const apply = () => {
      box.checked = wide.matches && read(NAV) === "folded";
      root.dataset.nav = box.checked ? "folded" : "open";
    };
    apply();
    box.addEventListener("change", () => {
      if (wide.matches) write(NAV, box.checked ? "folded" : "open");
      root.dataset.nav = box.checked ? "folded" : "open";
    });
    wide.addEventListener("change", apply);
  });
})();`;

function pageDocument(cfg: BookConfig, opts: {
  title: string;
  content: string;
  sidebar: string;
  headerTitle: string;
  prev: { label: string; href: string } | null;
  next: { label: string; href: string } | null;
  styleHref: string;
  /** The description, canonical and social `<head>` tags. */
  meta: string;
  /** The favicon link, relative to the page, or null. */
  faviconHref: string | null;
  /** The footer's HTML, with the book's own links. */
  footer: string;
  head: string;
}): string {
  const prevNav = opts.prev
    ? `<div class="prev"><span class="nav-label">${escapeHtml(ui(cfg, "previous"))}</span><a href="${opts.prev.href}">${escapeHtml(opts.prev.label)}</a></div>`
    : "";
  const nextNav = opts.next
    ? `<div class="next"><span class="nav-label">${escapeHtml(ui(cfg, "next"))}</span><a href="${opts.next.href}">${escapeHtml(opts.next.label)}</a></div>`
    : "";
  const favicon = opts.faviconHref ? `<link rel="icon" href="${opts.faviconHref}">\n` : "";
  return `<!DOCTYPE html>
<html lang="${escapeHtml(cfg.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>${SITE_SCRIPT}</script>
<title>${escapeHtml(opts.title)}</title>
${fontLinks(cfg)}
${opts.meta}
${favicon}<link rel="stylesheet" href="${opts.styleHref}">
${opts.head}
<noscript><style>.theme-toggle { display: none; }</style></noscript>
</head>
<body>
<input type="checkbox" id="sidebar-toggle" aria-label="${escapeHtml(ui(cfg, "toggle-navigation"))}">
${opts.sidebar}
<div class="page-wrapper">
  <header class="book-header">
    <label for="sidebar-toggle" class="menu-toggle" title="${escapeHtml(ui(cfg, "toggle-navigation"))}">&#9776;</label>
    <span class="header-title">${escapeHtml(opts.headerTitle)}</span>
    <span class="header-nav">
      ${opts.prev ? `<a href="${opts.prev.href}">&#8592; ${escapeHtml(ui(cfg, "previous"))}</a>` : ""}
      ${opts.next ? `<a href="${opts.next.href}">${escapeHtml(ui(cfg, "next"))} &#8594;</a>` : ""}
    </span>
    <button class="theme-toggle" type="button" aria-pressed="false" aria-label="${escapeHtml(ui(cfg, "toggle-theme"))}" title="${escapeHtml(ui(cfg, "toggle-theme"))}">
      <span class="theme-icon-sun" aria-hidden="true">&#9728;</span>
      <span class="theme-icon-moon" aria-hidden="true">&#9790;</span>
    </button>
  </header>
  <main class="book-body">${opts.content}</main>
  <nav class="chapter-nav">${prevNav}${nextNav}</nav>
  <footer class="book-footer">${opts.footer}</footer>
</div>
</body>
</html>`;
}

export function assemblePage(cfg: BookConfig, opts: {
  title: string;
  content: string;
  items: { kind: "group" | "entry"; label: string; relBook?: string; indent?: number }[];
  pages: Map<string, string>;
  activeOutputRel: string | null;
  homeOutputRel: string;
  prev: NavSlot | null;
  next: NavSlot | null;
  /** The page's source path from the book root, for `{path}` in footer links. */
  sourcePath: string | null;
  /** The favicon's output path, relative to the site root, or null. */
  faviconOutput: string | null;
  /** Extra `<head>` HTML from the book's `web.head`, or "". */
  head: string;
}): string {
  const from = opts.activeOutputRel ?? "index.html";
  const homeHref = pageHref(from, opts.homeOutputRel, cfg.web.prettyUrls);
  const styleHref = assetHref(from, "assets/style.css");
  const url = pageUrl(cfg, from, cfg.web.prettyUrls);
  const sidebar = sidebarHtml(cfg, opts.items, opts.pages, opts.activeOutputRel, homeHref);
  return pageDocument(cfg, {
    title: opts.title,
    content: opts.content,
    sidebar,
    headerTitle: opts.title === cfg.title ? cfg.title : `${cfg.title} — ${opts.title}`,
    prev: opts.prev ? { label: opts.prev.label, href: pageHref(from, opts.prev.outputRel, cfg.web.prettyUrls) } : null,
    next: opts.next ? { label: opts.next.label, href: pageHref(from, opts.next.outputRel, cfg.web.prettyUrls) } : null,
    styleHref,
    meta: metaTags(cfg, { title: opts.title, url }),
    faviconHref: opts.faviconOutput ? assetHref(from, opts.faviconOutput) : null,
    footer: footerHtml(cfg, opts.sourcePath, url),
    head: opts.head,
  });
}

/** A book's own file, read as UTF-8, or "" when the config names none. */
function bookFile(file: string): string {
  return file ? fs.readFileSync(file, "utf8").trim() : "";
}

/** The book's own `<head>` HTML (`web.head`), injected into every page, or "". */
export function headHtml(cfg: BookConfig): string {
  return bookFile(cfg.web.head);
}

/** The site's stylesheet: the configured families and palette, the content
 *  rules shared with the standalone layout, the layout itself, and the book's
 *  own `web.css` last — four built-in sources pasted together here rather than
 *  at a CSS build step, with the book's file able to override any of them. */
export function stylesheet(cfg: BookConfig): string {
  const content = readCss(import.meta.url, "../lib/content.css");
  const layout = readCss(import.meta.url, "site.css");
  const book = bookFile(cfg.web.css);
  return [fontCssVars(cfg), webPaletteVars(cfg), content, layout, book].filter(Boolean).join("\n\n");
}
