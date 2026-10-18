// The printed edition's picture measurer: a png's own pixel size, and `null` for
// anything it cannot read. Reading a header is all this adapter does; the
// fixture images are the same ones `test/build-tex-book/tex.test.ts` sizes.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HeaderImageMeasurer } from "../../../src/adapters/images/image-measurer.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.resolve(here, "..", "..", "fixtures", "images");

describe("HeaderImageMeasurer — a picture's own pixel size", () => {
  const measurer = new HeaderImageMeasurer();

  it("reads a png's width and height", () => {
    expect(measurer.measure(path.join(imagesDir, "small.png"))).toEqual({ width: 40, height: 20 });
  });

  it("answers null for a file that is not there", () => {
    expect(measurer.measure(path.join(imagesDir, "no-such-image.png"))).toBeNull();
  });
});
