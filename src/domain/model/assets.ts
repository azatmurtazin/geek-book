// A picture to place, and the copies the build makes of the book's files.
//
// Pure: no imports outside `domain/`.

/** A size in pixels, as an SVG viewBox or an image header states it. */
export interface PixelSize {
  readonly width: number;
  readonly height: number;
}

/** A drawing of a mermaid fence, to be written out as a PDF figure. */
export interface Figure {
  /** Output base name: `figures/<name>.svg` / `.pdf`. */
  name: string;
  svg: string;
  /**
   * The drawing's own size, as its viewBox states it — SVG user units, which are
   * CSS pixels at 96 to the inch — or `null` when the SVG carries no viewBox.
   */
  size: PixelSize | null;
}

/** A book file the build copies into `figures/`, under a name LaTeX is happy with. */
export interface ImageAsset {
  /** Source, relative to the book directory, e.g. `images/cover.jpg`. */
  relBook: string;
  /** Name of the copy under `figures/`, e.g. `c4-i0.jpg`. */
  name: string;
}
