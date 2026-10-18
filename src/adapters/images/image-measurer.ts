// The image-measuring adapter: `ImageMeasurer` over `lib/image-size`.
//
// The printed edition has to state a picture's size up front, and reading it
// from the file's own header — in pixels, the unit the web edition lays out in
// — is what keeps the two editions agreeing (see `lib/image-size.ts`).

import { imagePixels } from "../../lib/image-size.js";
import type { ImageMeasurer } from "../../application/ports/image-measurer.js";
import type { PixelSize } from "../../domain/model/assets.js";

export class HeaderImageMeasurer implements ImageMeasurer {
  measure(file: string): PixelSize | null {
    return imagePixels(file);
  }
}
