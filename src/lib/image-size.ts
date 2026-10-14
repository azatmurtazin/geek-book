// How large a picture is, in pixels, read from the file itself.
//
// The web edition needs no sizes: the browser lays a picture out at its own
// pixel size and stops it at the column width. The printed edition has to say a
// size up front, and if it says nothing LaTeX uses whatever resolution the file
// happens to carry — 72 dpi for a file that carries none — so a small drawing
// would be blown up and a large one could spill past the margins. Reading the
// header lets the print builder measure in the same units the web edition
// renders in: pixels, one to the inch's ninety-sixth.
//
// Only png and jpeg are read, the two formats the printed edition can embed
// (see lib/remote-images.ts). Anything else — or a file that is missing, or
// corrupt — comes back `null`, and the caller falls back on its own default.

import fs from "node:fs";

/** Width and height in pixels. */
export interface ImagePixels {
  width: number;
  height: number;
}

/** The pixel size of a png or jpeg file, or `null` when it cannot be read. */
export function imagePixels(file: string): ImagePixels | null {
  let header: Buffer;
  try {
    // Headers are short, but a jpeg may carry a colour profile or an EXIF
    // thumbnail ahead of the frame, so read enough to walk past one.
    header = fs.readFileSync(file);
  } catch {
    return null;
  }
  return pngPixels(header) ?? jpegPixels(header);
}

/** The size a png's IHDR chunk names; `null` for anything but a png. */
function pngPixels(buffer: Buffer): ImagePixels | null {
  if (buffer.length < 24 || buffer.toString("latin1", 1, 4) !== "PNG") {
    return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** The size a jpeg's frame header names; `null` for anything but a jpeg. */
function jpegPixels(buffer: Buffer): ImagePixels | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }
  let offset = 2;
  while (offset + 9 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      // Fill byte before a marker.
      offset += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      // Standalone markers carry no length and no data.
      offset += 2;
      continue;
    }
    if (marker === 0xd9) {
      // End of image, reached without a frame header.
      return null;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) {
      return null;
    }
    // SOF0–SOF3, SOF5–SOF7, SOF9–SOF11 and SOF13–SOF15 hold the frame size.
    // The four that sit among them hold something else: 0xc4 huffman tables,
    // 0xc8 an extension, 0xcc arithmetic coding.
    const frame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (frame) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    offset += 2 + length;
  }
  return null;
}
