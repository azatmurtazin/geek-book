// The fixed interface labels the two editions print, and the rule that reads
// them: a book's `strings` override, else the English default.
//
// This is the book's *interface* language, not the `language` key (which sets
// the HTML `lang` attribute and the PDF's hyphenation). Pure: no imports outside
// `domain/`.

/** A book's label overrides, keyed as `UI_DEFAULTS` is. */
export type UiStrings = Readonly<Record<string, string>>;

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
export function label(strings: UiStrings, key: UIKey): string {
  return strings[key] ?? UI_DEFAULTS[key];
}
