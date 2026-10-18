// The fixed labels the two editions print — the previous and next links, the
// table of contents heading, the Home link and the accessible names of the two
// controls. They are English by default; a book in another language overrides
// any of them with the `strings` map in its config.
//
// The defaults and the lookup live in `domain/values/ui-strings.ts`; this is the
// legacy path, and the one place that reads a `BookConfig`.

import type { BookConfig } from "./book-config.js";
import { label, type UIKey } from "../domain/values/ui-strings.js";

export { UI_DEFAULTS } from "../domain/values/ui-strings.js";
export type { UIKey, UiStrings } from "../domain/values/ui-strings.js";

/** The label for `key`: the book's override, else the English default. */
export function ui(cfg: BookConfig, key: UIKey): string {
  return label(cfg.strings, key);
}
