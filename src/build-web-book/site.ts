// Turn chapter bodies into a full HonKit-style web book: a fixed sidebar with
// the SUMMARY tree, a header with prev/next, and per-chapter pages whose
// internal .md links and #anchors are rewritten to the built .html files.

import path from "node:path";
import { escapeHtml, brandHtml } from "../lib/html.js";
import { CONFIG } from "../lib/book-config.js";
import { resolveImagePath } from "../lib/images.js";
import { REMOTE_IMAGE_DIR, type RemoteImages } from "../lib/remote-images.js";
import { FONT_LINKS } from "../lib/fonts.js";
import { SITE_CSS } from "./site.css.js";

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

/** The storage key the reader's day/night choice is remembered under. */
const THEME_KEY = "geek-book-theme";

// The one script the site carries: it puts the reader's theme on <html> before
// the first paint (their stored choice, else the system preference) and wires
// the header button to flip it. Everything else on the page — including the
// foldable sidebar — works without it, so a reader with scripts off gets the
// light theme and a `<details>` tree that still folds. Storage is guarded
// because a browser in private mode (or with cookies off) throws on access —
// then the choice is simply not kept.
const THEME_SCRIPT = `(() => {
  const KEY = "${THEME_KEY}";
  const root = document.documentElement;
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = (value) => { try { localStorage.setItem(KEY, value); } catch { /* not kept */ } };
  root.dataset.theme = read() ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  addEventListener("DOMContentLoaded", () => {
    const button = document.querySelector(".theme-toggle");
    if (!button) return;
    const mark = () => button.setAttribute("aria-pressed", String(root.dataset.theme === "dark"));
    mark();
    button.addEventListener("click", () => {
      const dark = root.dataset.theme !== "dark";
      root.dataset.theme = dark ? "dark" : "light";
      write(root.dataset.theme);
      mark();
    });
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
}): string {
  const prevNav = opts.prev
    ? `<div class="prev"><span class="nav-label">Previous</span><a href="${opts.prev.href}">${escapeHtml(opts.prev.label)}</a></div>`
    : "";
  const nextNav = opts.next
    ? `<div class="next"><span class="nav-label">Next</span><a href="${opts.next.href}">${escapeHtml(opts.next.label)}</a></div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>${THEME_SCRIPT}</script>
<title>${escapeHtml(opts.title)}</title>
${FONT_LINKS}
<link rel="stylesheet" href="${opts.styleHref}">
<noscript><style>.theme-toggle { display: none; }</style></noscript>
</head>
<body>
<input type="checkbox" id="sidebar-toggle">
${opts.sidebar}
<div class="page-wrapper">
  <header class="book-header">
    <label for="sidebar-toggle" class="menu-toggle" title="Toggle navigation">&#9776;</label>
    <span class="header-title">${escapeHtml(opts.headerTitle)}</span>
    <span class="header-nav">
      ${opts.prev ? `<a href="${opts.prev.href}">&#8592; Previous</a>` : ""}
      ${opts.next ? `<a href="${opts.next.href}">Next &#8594;</a>` : ""}
    </span>
    <button class="theme-toggle" type="button" aria-pressed="false" aria-label="Toggle day/night theme" title="Toggle day/night theme">
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
  });
}

export function stylesheet(): string {
  return SITE_CSS;
}
