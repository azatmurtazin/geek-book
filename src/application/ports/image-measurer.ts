// The port the printed edition measures local pictures through.
//
// A measurer reads a picture file's own pixel size, so a serializer can size it
// against the text block; reading a png or jpeg header is an adapter's business
// (see `adapters/images/image-measurer.ts`).

import type { PixelSize } from "../../domain/model/assets.js";

export interface ImageMeasurer {
  /** A png or jpeg's pixel size, or `null` when it cannot be read. */
  measure(file: string): PixelSize | null;
}
