// A fence language's presentation: the label a code block shows and how its
// comments are marked. The book's own `code` map comes first, then the built-in
// table in `domain/values/code-language.ts`, so a book can teach the renderers a
// language they do not know without forking them. Both the HTML and the LaTeX
// renderers read this through code-tokens.ts and their own label lookup, so a
// book's language looks the same in the website and the PDF.
//
// This is the legacy path; the lookups now take a book's `code` map directly.

export { codeLabel, commentStyle } from "../domain/values/code-language.js";
