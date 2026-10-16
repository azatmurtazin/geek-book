// The site's navigation chrome: the SUMMARY sidebar and the page footer.
//
// Both are assembled here rather than in the page template, so what a page has
// around its body reads in one place.

import path from "node:path";
import { escapeHtml, brandHtml } from "../lib/html.js";
import type { BookConfig } from "../lib/book-config.js";

/** A footer link's target: `{path}` becomes the page's source path from the
 *  book root, `{url}` its absolute URL (empty when none is known). */
function linkHref(href: string, sourcePath: string | null, url: string): string {
  return href.replaceAll("{path}", sourcePath ?? "").replaceAll("{url}", url);
}

/** The footer: the book's name and version, then the book's own links. */
export function footerHtml(cfg: BookConfig, sourcePath: string | null, url: string): string {
  const head = `${escapeHtml(cfg.title)} ${escapeHtml(cfg.version)}`;
  const text = cfg.tagline ? `${head} — ${escapeHtml(cfg.tagline)}` : head;
  const links = cfg.web.links
    .map((link) => `<a href="${escapeHtml(linkHref(link.href, sourcePath, url))}">${escapeHtml(link.label)}</a>`)
    .join("");
  const nav = links ? `<span class="book-footer-links">${links}</span>` : "";
  return `<span class="book-footer-text">${text}</span>${nav}`;
}

/**
 * The SUMMARY tree as sidebar rows. A group heading opens a `<details>` that
 * folds its chapters away, so the tree stays short on a long book; the part the
 * current page belongs to is left open, and entries that precede the first
 * heading stay in the open.
 */
export function sidebarHtml(
  cfg: BookConfig,
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
  <div class="sidebar-brand"><a href="${homeHref}">${brandHtml(cfg.title)}</a></div>
  <ul>
    ${rows.join("\n    ")}
  </ul>
</nav>`;
}
