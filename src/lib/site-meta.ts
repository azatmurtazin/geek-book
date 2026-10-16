// The site's own metadata: the base path, the canonical address of a page and
// the social card tags. Built from the config and a page's path, and shared by
// the web book (build-web-book) and the standalone layout (md-to-html), so the
// two editions cannot describe the same book differently.

import { escapeHtml } from "./html.js";
import type { BookConfig } from "./book-config.js";

/**
 * The path the site is served under — `web.baseUrl`'s path — so the root links
 * (the brand and the standalone page's Home link) land on the site rather than
 * on the host's root. `/` when no base URL is set, which is the common case.
 */
export function basePath(cfg: BookConfig): string {
  const base = cfg.web.baseUrl;
  if (!base) return "/";
  if (base.startsWith("/")) return base;
  try {
    return new URL(base).pathname;
  } catch {
    return "/";
  }
}

/**
 * The absolute URL of a page, or "" when `web.baseUrl` is empty or a bare path.
 * The home page is the base itself, so its canonical does not name index.html.
 */
export function pageUrl(cfg: BookConfig, outputRel: string): string {
  const base = cfg.web.baseUrl;
  if (!base || base.startsWith("/")) return "";
  return outputRel === "index.html" ? base : `${base}${outputRel}`;
}

/**
 * The `<head>` metadata for a page: the description, the canonical link when a
 * base URL is known, and the Open Graph and Twitter card tags social sites read.
 * `url` is "" for a page with no absolute address (the standalone layout).
 */
export function metaTags(cfg: BookConfig, opts: { title: string; url: string }): string {
  const description = cfg.web.description;
  const lines: string[] = [];
  if (description) {
    lines.push(`<meta name="description" content="${escapeHtml(description)}">`);
  }
  if (cfg.author) {
    lines.push(`<meta name="author" content="${escapeHtml(cfg.author)}">`);
  }
  if (opts.url) {
    lines.push(`<link rel="canonical" href="${escapeHtml(opts.url)}">`);
  }
  lines.push(`<meta property="og:type" content="website">`);
  lines.push(`<meta property="og:site_name" content="${escapeHtml(cfg.title)}">`);
  lines.push(`<meta property="og:title" content="${escapeHtml(opts.title)}">`);
  if (description) {
    lines.push(`<meta property="og:description" content="${escapeHtml(description)}">`);
  }
  if (opts.url) {
    lines.push(`<meta property="og:url" content="${escapeHtml(opts.url)}">`);
  }
  lines.push(`<meta name="twitter:card" content="summary">`);
  lines.push(`<meta name="twitter:title" content="${escapeHtml(opts.title)}">`);
  if (description) {
    lines.push(`<meta name="twitter:description" content="${escapeHtml(description)}">`);
  }
  return lines.join("\n");
}
