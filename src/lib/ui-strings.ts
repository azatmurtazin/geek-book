// The fixed labels the two editions print — the previous and next links, the
// table of contents heading, the Home link and the accessible names of the two
// controls. They are English by default; a book in another language overrides
// any of them with the `strings` map in its config, the same way the prose
// overrides tokens with `placeholders`.
//
// This is the book's *interface* language, not the `language` key (which sets
// the HTML `lang` attribute and the PDF's hyphenation) and not the linter's
// `languages` (which are the fence tags it accepts). A book that names a
// `language` and wants a translated interface says so here.

import type { BookConfig } from "./book-config.js";

/** The built-in English labels, keyed as the config's `strings` overrides them. */
export const UI_DEFAULTS = {
  previous: "Previous",
  next: "Next",
  contents: "Table of Contents",
  home: "Home",
  "toggle-navigation": "Toggle navigation",
  "toggle-theme": "Toggle day/night theme",
} as const;

export type UIKey = keyof typeof UI_DEFAULTS;

/** The label for `key`: the book's override, else the English default. */
export function ui(cfg: BookConfig, key: UIKey): string {
  return cfg.strings[key] ?? UI_DEFAULTS[key];
}
