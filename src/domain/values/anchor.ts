// The heading-id rule both editions and the linter slug by.
//
// The website's renderer, the print walk and the linter all reach an anchor the
// same way, so a link names the same heading on the site, on the page, and in a
// check. Pure: no imports outside `domain/`.

/** A heading id, as both editions emit it. A string at runtime; the brand keeps
 *  a slug from being passed where an ordinary string is expected by accident. */
export type Anchor = string & { readonly __brand: "Anchor" };

/** Approximate the header identifier algorithm the renderers emit, close enough to check. */
export function slugify(text: string): Anchor {
  const withoutMarkup = text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1");
  const stripped = withoutMarkup.toLowerCase().replace(/[^\p{L}\p{N}_\- ]+/gu, "");
  return stripped.replace(/ /g, "-") as Anchor;
}
