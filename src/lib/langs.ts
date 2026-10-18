// The built-in knowledge about the languages in the book — the linter's default
// allow-list, the comment syntax and the label each language starts with.
//
// The tables live in `domain/values/code-language.ts`; this is the legacy path.
// The `commentStyle`/`codeLabel` lookups there take a book's `code` map directly
// (see `code-meta.ts`).

export {
  CODE_LABELS,
  DEFAULT_LANGS,
  HASH_COMMENT_LANGS,
  SLASH_COMMENT_LANGS,
} from "../domain/values/code-language.js";
