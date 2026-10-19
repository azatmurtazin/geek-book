// A run of inline content — the text of a paragraph, heading, cell or item —
// and the linked and pictured pieces it may carry.
//
// Pure: no imports outside `domain/`.

/** A link: `target` names a place in the book, or `null` for an outside URL. */
export interface LinkNode {
  kind: "link";
  href: string;
  target: string | null;
  content: Inline[];
}

/** A picture: in the flow of a sentence, or standing alone as a block. */
export interface ImageNode {
  kind: "image";
  /**
   * The source the Markdown spelled, before any resolution.
   *
   * The web edition links a picture by its source (a book file is copied beside
   * the page, a remote one points at the build's fetched copy), so the renderer
   * needs the spelling the author wrote, not only the copy the print build made.
   */
  src: string;
  /** The file to embed, or `null` when the source has no file — alt text then. */
  ref: ImageRef | null;
  /** The Markdown alt text: shown on the web, and the print fallback above. */
  alt: string;
}

/** A picture to place: the file to read, and the copy the build makes of it. */
export interface ImageRef {
  /** Absolute path of the file to embed — a book file, or a fetched remote copy. */
  file: string;
  /** Name of the copy under the build's `figures/` directory. */
  name: string;
}

/** A run of inline content: the text of a paragraph, heading, cell or item. */
export type Inline =
  /** Literal text, entities already decoded. */
  | { kind: "text"; text: string }
  /** `code`, set apart from the prose. */
  | { kind: "code"; text: string }
  | { kind: "strong"; content: Inline[] }
  | { kind: "em"; content: Inline[] }
  /** Struck-through text; the print edition keeps the text and drops the strike. */
  | { kind: "del"; content: Inline[] }
  /** A hard line break. */
  | { kind: "break" }
  | LinkNode
  | ImageNode;
