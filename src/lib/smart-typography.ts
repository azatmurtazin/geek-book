// Smart typography: straight quotes to curly ones, and `--`/`---` to dashes.
//
// A book that asks for it (see `markdown.smartTypography`) reads its prose with
// a typographer's punctuation on both editions. The engine and the walk over
// the neutral document tree now live in `domain/values/smart-typography.ts`;
// this is the legacy path the linter still names for the string form.

export { smartTypography } from "../domain/values/smart-typography.js";
