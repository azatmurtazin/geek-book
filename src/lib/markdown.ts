// Generic markdown helpers shared by the renderers and the linter. They live in
// a neutral module so neither side depends on the other.
//
// `slugify` and `splitLines` are pure and live in `domain/values/`; this is the
// legacy path the linter and a few tests still name. The `marked` renderer that
// once lived here is gone: the website renders from the document tree.

export { slugify } from "../domain/values/anchor.js";
export { splitLines } from "../domain/values/text.js";
