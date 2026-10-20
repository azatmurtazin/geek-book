// The book's document tree — what a chapter *is*, before a page spells it.
//
// The model types now live in `domain/model/`; this is the legacy path and the
// re-export the print builder's stages still name. `ChapterContext` extends the
// domain's with the remote-image cache the print build fetches through, which
// the domain itself must not know.

import type { RemoteImages } from "../adapters/http/remote-images.js";
import type { ChapterContext as BaseChapterContext } from "../domain/model/chapter.js";

export type { Figure, ImageAsset, PixelSize } from "../domain/model/assets.js";
export type { ImageNode, ImageRef, Inline, LinkNode } from "../domain/model/inline.js";
export type {
  Align,
  Block,
  Chapter,
  HeadingBlock,
  HeadingDepth,
  ListBlock,
  TableBlock,
  TableRow,
} from "../domain/model/chapter.js";

/** Where a chapter sits in the book, and what its links resolve against. */
export interface ChapterContext extends BaseChapterContext {
  /** Remote images already fetched for this build (see adapters/http/remote-images.ts). */
  remote?: RemoteImages;
}
