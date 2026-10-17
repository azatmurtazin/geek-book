// Turn chapter bodies into a full HonKit-style web book: a fixed sidebar with
// the SUMMARY tree, a header with prev/next, and per-chapter pages whose
// internal .md links and #anchors are rewritten to the built .html files.
//
// The pieces live beside this file: `links.ts` (the href and image rewriting),
// `nav.ts` (the sidebar and footer) and `page.ts` (the page template, its head
// script and the site's shared assets). This module re-exports them, so
// importers keep naming `site.js`.

export type { MappedChapter, NavSlot } from "./page.js";
export { assemblePage, headHtml, stylesheet } from "./page.js";
export { rewriteImages, rewriteLinks } from "./links.js";
export { assetHref, outputRelFor, pageHref } from "./paths.js";
