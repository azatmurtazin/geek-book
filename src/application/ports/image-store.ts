// The port the pipeline fetches remote images through.
//
// A store fetches every remote image a chapter references and then answers
// where a URL's copy is and what it was saved as; fetching is an adapter's
// business (see `adapters/http/remote-images.ts`).

import type { MdNode } from "../../domain/model/markdown.js";

/** A fetched remote image: the file on disk and the name it was saved under. */
export interface StoredImage {
  /** Absolute path the URL was fetched to. */
  readonly file: string;
  /** File name inside the download directory, e.g. `<sha1>.png`. */
  readonly name: string;
}

export interface ImageStore {
  /** Fetch every remote image the neutral tree references. Throws when one fails. */
  collect(nodes: readonly MdNode[]): Promise<void>;
  /** Where a URL's fetched copy is, or `null` when this build did not fetch it. */
  lookup(url: string): StoredImage | null;
  /** How many files this build fetched; repeats of a URL do not count again. */
  readonly fetched: number;
}
