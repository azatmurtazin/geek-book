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
// (see adapters/http/remote-images.ts). The file is opened once, the bytes the
// header walk needs are read, and the answer is memoized against the file's
// size and modification time. Anything else — or a file that is missing, or
// corrupt — comes back `null`, and the caller falls back on its own default.

import fs from "node:fs";

/** Width and height in pixels. */
export interface ImagePixels {
  width: number;
  height: number;
}

interface CachedPixels {
  readonly size: number;
  readonly mtimeMs: number;
  readonly pixels: ImagePixels | null;
}

const cache = new Map<string, CachedPixels>();

/** The pixel size of a png or jpeg file, or `null` when it cannot be read. */
export function imagePixels(file: string): ImagePixels | null {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return null;
  }
  if (!stat.isFile()) {
    return null;
  }

  const cached = cache.get(file);
  if (cached !== undefined && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
    return cached.pixels;
  }

  const pixels = readPixels(file);
  cache.set(file, { size: stat.size, mtimeMs: stat.mtimeMs, pixels });
  return pixels;
}

/** Open `file` and measure its header without reading the rest of the image. */
function readPixels(file: string): ImagePixels | null {
  let fd: number;
  try {
    fd = fs.openSync(file, "r");
  } catch {
    return null;
  }

  try {
    const pixels = pngPixels(readAt(fd, 24, 0));
    return pixels ?? jpegPixels(fd);
  } catch {
    return null;
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // The size is still the answer; a close failure does not change it.
    }
  }
}

/** At most `length` bytes at `position`, possibly fewer at end of file. */
function readAt(fd: number, length: number, position: number): Buffer {
  const buffer = Buffer.allocUnsafe(length);
  const read = fs.readSync(fd, buffer, 0, length, position);
  return buffer.subarray(0, read);
}

/** The size a png's IHDR chunk names; `null` for anything but a png. */
function pngPixels(buffer: Buffer): ImagePixels | null {
  if (buffer.length < 24 || buffer.toString("latin1", 1, 4) !== "PNG") {
    return null;
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/**
 * The size a jpeg's frame header names; `null` for anything but a jpeg.
 *
 * Segments carry a 16-bit length, so a large EXIF block or colour profile can
 * sit ahead of the frame. The walk reads a marker and its length, then seeks
 * past the payload; only the frame header itself is read in full.
 */
function jpegPixels(fd: number): ImagePixels | null {
  const start = readAt(fd, 2, 0);
  if (start.length < 2 || start[0] !== 0xff || start[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  for (;;) {
    const markerBytes = readAt(fd, 2, offset);
    if (markerBytes.length < 2) {
      return null;
    }
    if (markerBytes[0] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = markerBytes[1];
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

    const lengthBytes = readAt(fd, 2, offset + 2);
    if (lengthBytes.length < 2) {
      return null;
    }
    const length = lengthBytes.readUInt16BE(0);
    if (length < 2) {
      return null;
    }

    // SOF0–SOF3, SOF5–SOF7, SOF9–SOF11 and SOF13–SOF15 hold the frame size.
    // The four that sit among them hold something else: 0xc4 huffman tables,
    // 0xc8 an extension, 0xcc arithmetic coding.
    const frame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (frame) {
      // After the length: precision (1 byte), height (2), width (2).
      const header = readAt(fd, 5, offset + 4);
      if (header.length < 5) {
        return null;
      }
      return { width: header.readUInt16BE(3), height: header.readUInt16BE(1) };
    }

    offset += 2 + length;
  }
}
