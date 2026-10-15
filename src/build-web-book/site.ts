// Turn chapter bodies into a full HonKit-style web book: a fixed sidebar with
// the SUMMARY tree, a header with prev/next, and per-chapter pages whose
// internal .md links and #anchors are rewritten to the built .html files.

import path from "node:path";
import fs from "node:fs";
import { escapeHtml, brandHtml } from "../lib/html.js";
import { CONFIG } from "../lib/book-config.js";
import { resolveImagePath } from "../lib/images.js";
import { REMOTE_IMAGE_DIR, type RemoteImages } from "../lib/remote-images.js";
import { FONT_CSS_VARS, FONT_LINKS } from "../lib/fonts.js";
import { readCss } from "../lib/css.js";
import { WEB_PALETTE_VARS } from "../lib/web-palette.js";
import { ui } from "../lib/ui-strings.js";

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

/** Resolve a markdown-relative link target to a book-relative path. */
function resolveLocal(fromRelBook: string, hrefPath: string): string {
  const dir = path.posix.dirname(fromRelBook.replace(/\\/g, "/"));
  return path.posix.normalize(path.posix.join(dir, hrefPath));
}

/** Rewrite `path.md` / `path.md#anchor` hrefs to relative `.html` links. */
export function rewriteLinks(body: string, fromRelBook: string, pages: Map<string, string>): string {
  const fromDir = path.posix.dirname(fromRelBook.replace(/\\/g, "/"));
  return body.replace(/href="([^"#]*)(#[^"]*)?"/g, (whole, rawPath: string, anchor: string) => {
    const href = rawPath.toLowerCase();
    if (!href.endsWith(".md") && !href.endsWith(".md/")) {
      return whole;
    }
    const targetRel = resolveLocal(fromRelBook, rawPath);
    const outputRel = pages.get(targetRel);
    if (outputRel === undefined) {
      return whole; // leave unresolved links untouched
    }
    const rel = path.posix.relative(fromDir, outputRel) || path.posix.basename(outputRel);
    return `href="${rel}${anchor ?? ""}"`;
  });
}

const IMG_RE = /(<img\b[^>]*?\bsrc=")([^"]*)(")/g;

/**
 * Rewrite every `<img src>` to a path relative to the built page and collect
 * the book-relative source paths, so the build can copy the files into the
 * output tree. Remote sources point at the copies `remote` fetched into
 * `images/remote/`, so the built site carries its pictures with it. Sources
 * outside the book, and schemes nothing fetches, are left alone.
 */
export function rewriteImages(
  body: string,
  fromRelBook: string,
  fromOutputRel: string,
  remote?: RemoteImages,
): { body: string; assets: string[] } {
  const assets: string[] = [];
  const fromDir = path.posix.dirname(fromOutputRel.replace(/\\/g, "/"));
  const out = body.replace(IMG_RE, (whole, prefix: string, src: string, suffix: string) => {
    const bookRel = resolveImagePath(src, fromRelBook);
    if (bookRel === null) {
      const fetched = remote?.nameFor(src) ?? null;
      if (fetched === null) {
        return whole;
      }
      const rel = path.posix.relative(fromDir, path.posix.join(REMOTE_IMAGE_DIR, fetched));
      return `${prefix}${rel || fetched}${suffix}`;
    }
    if (!assets.includes(bookRel)) {
      assets.push(bookRel);
    }
    const rel = path.posix.relative(fromDir, bookRel) || path.posix.basename(bookRel);
    return `${prefix}${rel}${suffix}`;
  });
  return { body: out, assets };
}

/** `<title> <version> — <tagline>`, the tagline dropped when there is none. */
function footerHtml(): string {
  const head = `${escapeHtml(CONFIG.title)} ${escapeHtml(CONFIG.version)}`;
  return CONFIG.tagline ? `${head} — ${escapeHtml(CONFIG.tagline)}` : head;
}

/**
 * The SUMMARY tree as sidebar rows. A group heading opens a `<details>` that
 * folds its chapters away, so the tree stays short on a long book; the part the
 * current page belongs to is left open, and entries that precede the first
 * heading stay in the open.
 */
function sidebarHtml(
  items: { kind: "group" | "entry"; label: string; relBook?: string; indent?: number }[],
  pages: Map<string, string>,
  activeOutputRel: string | null,
  homeHref: string,
): string {
  const fromDir = path.posix.dirname(activeOutputRel ?? "index.html");

  interface Part {
    label: string;
    rows: string[];
    active: boolean;
  }
  const parts: Part[] = [];
  const blocks: ({ row: string } | { part: Part })[] = [];
  let part: Part | null = null;

  for (const item of items) {
    if (item.kind === "group") {
      part = { label: item.label, rows: [], active: false };
      parts.push(part);
      blocks.push({ part });
      continue;
    }
    const outputRel = pages.get(item.relBook ?? "");
    if (!outputRel) continue;
    const active = outputRel === activeOutputRel;
    const href = path.posix.relative(fromDir, outputRel) || path.posix.basename(outputRel);
    const row = `<li class="sidebar-chapter depth-${Math.min(item.indent ?? 0, 2)}"><a href="${href}"${active ? ' class="active"' : ""}>${escapeHtml(item.label)}</a></li>`;
    if (part) {
      part.rows.push(row);
      part.active ||= active;
    } else {
      blocks.push({ row });
    }
  }

  // The part the current page lives in unfolds itself; a page outside the tree
  // (the front page) opens the first part with chapters instead, so the sidebar
  // never opens empty.
  const openPart = parts.find((candidate) => candidate.active)
    ?? parts.find((candidate) => candidate.rows.length > 0)
    ?? null;

  const rows = blocks.map((block) => {
    if ("row" in block) return block.row;
    const open = block.part === openPart ? " open" : "";
    const entries = block.part.rows;
    const list = entries.length
      ? `\n      <ul>\n        ${entries.join("\n        ")}\n      </ul>\n    `
      : "";
    return `<li><details${open}>\n    <summary class="sidebar-part">${escapeHtml(block.part.label)}</summary>${list}</details></li>`;
  });

  return `<nav class="sidebar">
  <div class="sidebar-brand"><a href="${homeHref}">${brandHtml(CONFIG.title)}</a></div>
  <ul>
    ${rows.join("\n    ")}
  </ul>
</nav>`;
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

function pageDocument(opts: {
  title: string;
  content: string;
  sidebar: string;
  headerTitle: string;
  prev: { label: string; href: string } | null;
  next: { label: string; href: string } | null;
  styleHref: string;
  head: string;
}): string {
  const prevNav = opts.prev
    ? `<div class="prev"><span class="nav-label">${escapeHtml(ui("previous"))}</span><a href="${opts.prev.href}">${escapeHtml(opts.prev.label)}</a></div>`
    : "";
  const nextNav = opts.next
    ? `<div class="next"><span class="nav-label">${escapeHtml(ui("next"))}</span><a href="${opts.next.href}">${escapeHtml(opts.next.label)}</a></div>`
    : "";
  return `<!DOCTYPE html>
<html lang="${escapeHtml(CONFIG.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>${SITE_SCRIPT}</script>
<title>${escapeHtml(opts.title)}</title>
${FONT_LINKS}
<link rel="stylesheet" href="${opts.styleHref}">
${opts.head}
<noscript><style>.theme-toggle { display: none; }</style></noscript>
</head>
<body>
<input type="checkbox" id="sidebar-toggle" aria-label="${escapeHtml(ui("toggle-navigation"))}">
${opts.sidebar}
<div class="page-wrapper">
  <header class="book-header">
    <label for="sidebar-toggle" class="menu-toggle" title="${escapeHtml(ui("toggle-navigation"))}">&#9776;</label>
    <span class="header-title">${escapeHtml(opts.headerTitle)}</span>
    <span class="header-nav">
      ${opts.prev ? `<a href="${opts.prev.href}">&#8592; ${escapeHtml(ui("previous"))}</a>` : ""}
      ${opts.next ? `<a href="${opts.next.href}">${escapeHtml(ui("next"))} &#8594;</a>` : ""}
    </span>
    <button class="theme-toggle" type="button" aria-pressed="false" aria-label="${escapeHtml(ui("toggle-theme"))}" title="${escapeHtml(ui("toggle-theme"))}">
      <span class="theme-icon-sun" aria-hidden="true">&#9728;</span>
      <span class="theme-icon-moon" aria-hidden="true">&#9790;</span>
    </button>
  </header>
  <main class="book-body">${opts.content}</main>
  <nav class="chapter-nav">${prevNav}${nextNav}</nav>
  <footer class="book-footer">${footerHtml()}</footer>
</div>
</body>
</html>`;
}

function hrefFrom(fromOutputRel: string, toOutputRel: string): string {
  const rel = path.posix.relative(path.posix.dirname(fromOutputRel), toOutputRel);
  return rel || path.posix.basename(toOutputRel);
}

export function assemblePage(opts: {
  title: string;
  content: string;
  items: { kind: "group" | "entry"; label: string; relBook?: string; indent?: number }[];
  pages: Map<string, string>;
  activeOutputRel: string | null;
  homeOutputRel: string;
  prev: NavSlot | null;
  next: NavSlot | null;
  /** Extra `<head>` HTML from the book's `web.head`, or "". */
  head: string;
}): string {
  const from = opts.activeOutputRel ?? "index.html";
  const homeHref = hrefFrom(from, opts.homeOutputRel);
  const styleHref = hrefFrom(from, "assets/style.css");
  const sidebar = sidebarHtml(opts.items, opts.pages, opts.activeOutputRel, homeHref);
  return pageDocument({
    title: opts.title,
    content: opts.content,
    sidebar,
    headerTitle: opts.title === CONFIG.title ? CONFIG.title : `${CONFIG.title} — ${opts.title}`,
    prev: opts.prev ? { label: opts.prev.label, href: hrefFrom(from, opts.prev.outputRel) } : null,
    next: opts.next ? { label: opts.next.label, href: hrefFrom(from, opts.next.outputRel) } : null,
    styleHref,
    head: opts.head,
  });
}

/** A book's own file, read as UTF-8, or "" when the config names none. */
function bookFile(file: string): string {
  return file ? fs.readFileSync(file, "utf8").trim() : "";
}

/** The book's own `<head>` HTML (`web.head`), injected into every page, or "". */
export function headHtml(): string {
  return bookFile(CONFIG.web.head);
}

/** The site's stylesheet: the configured families and palette, the content
 *  rules shared with the standalone layout, the layout itself, and the book's
 *  own `web.css` last — four built-in sources pasted together here rather than
 *  at a CSS build step, with the book's file able to override any of them. */
export function stylesheet(): string {
  const content = readCss(import.meta.url, "../lib/content.css");
  const layout = readCss(import.meta.url, "site.css");
  const book = bookFile(CONFIG.web.css);
  return [FONT_CSS_VARS, WEB_PALETTE_VARS, content, layout, book].filter(Boolean).join("\n\n");
}
