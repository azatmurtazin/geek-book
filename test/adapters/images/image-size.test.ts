// How large a png or jpeg is, read from the file's own header.
//
// The fixtures are the pictures the LaTeX tests size; the jpeg is synthetic so
// the walk over its segments — garbage, a fill byte, a standalone marker, an
// application segment, then a progressive frame — is written down rather than
// hidden in a binary.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { imagePixels } from "../../../src/adapters/images/image-size.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, "..", "..", "fixtures", "images");

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "geek-book-image-size-"));
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Write `bytes` under the temporary directory and hand back its path. */
function written(name: string, bytes: Uint8Array | string): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, bytes);
  return file;
}

/** A jpeg with a few segments the walk must pass before the frame header. */
const JPEG = Uint8Array.from([
  0xff, 0xd8, // start of image
  0x00, 0x00, 0x00, // junk the walk steps over
  0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0, length 4
  0xff, 0xff, // fill byte
  0xff, 0xd8, // a standalone marker
  0xff, 0xc2, 0x00, 0x11, 0x08, 0x00, 0x14, 0x00, 0x28, // progressive frame, 40 × 20
  0x00, 0x00, 0x00, // frame payload (not read)
]);

describe("imagePixels", () => {
  it("reads a png's dimensions from its IHDR chunk", () => {
    expect(imagePixels(path.join(fixtures, "small.png"))).toEqual({ width: 40, height: 20 });
    expect(imagePixels(path.join(fixtures, "wide.png"))).toEqual({ width: 3000, height: 100 });
    expect(imagePixels(path.join(fixtures, "tall.png"))).toEqual({ width: 100, height: 5000 });
  });

  it("walks a jpeg's segments to its frame header", () => {
    expect(imagePixels(written("frame.jpg", JPEG))).toEqual({ width: 40, height: 20 });
  });

  it("answers null for a file that is not there", () => {
    expect(imagePixels(path.join(dir, "no-such-image.png"))).toBeNull();
  });

  it("answers null for a truncated png and one with a bad signature", () => {
    expect(imagePixels(written("short.png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47])))).toBeNull();
    expect(imagePixels(written("wrong.png", Buffer.from("NOPE" + "x".repeat(20))))).toBeNull();
  });

  it("answers null for a jpeg that ends before a frame or has a bad length", () => {
    expect(imagePixels(written("empty.jpg", Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])))).toBeNull();
    expect(
      imagePixels(
        written("bad-length.jpg", Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x00, 0x00])),
      ),
    ).toBeNull();
  });

  it("answers null for a file that is not an image", () => {
    expect(imagePixels(written("notes.txt", "not a picture"))).toBeNull();
  });
});
